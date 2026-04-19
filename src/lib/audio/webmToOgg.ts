/**
 * Minimal WebM (Matroska/EBML) → OGG/Opus remuxer.
 *
 * The browser's MediaRecorder produces WebM containers wrapping Opus audio packets.
 * Meta's WhatsApp Business API rejects these because it inspects file magic bytes
 * and only accepts true OGG/Opus containers ("OggS" header).
 *
 * This remuxer extracts the raw Opus packets from the WebM SimpleBlocks/Blocks
 * and wraps them in an OGG container — no re-encoding, just a container swap.
 *
 * References:
 * - WebM/Matroska: https://www.matroska.org/technical/elements.html
 * - OGG: https://xiph.org/ogg/doc/framing.html
 * - Opus in OGG: https://datatracker.ietf.org/doc/html/rfc7845
 */

// ---------- EBML (WebM) parsing ----------

class EbmlReader {
  private view: DataView;
  private pos = 0;
  constructor(public buf: Uint8Array) {
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  get eof() { return this.pos >= this.buf.length; }
  get position() { return this.pos; }
  seek(p: number) { this.pos = p; }

  /** Read a variable-size integer (vint). If keepMask=true, keeps the leading 1-bit (used for IDs). */
  readVint(keepMask = false): number {
    if (this.pos >= this.buf.length) return -1;
    const first = this.buf[this.pos];
    if (first === 0) throw new Error('Invalid vint');
    let length = 1;
    let mask = 0x80;
    while (!(first & mask)) {
      length++;
      mask >>= 1;
      if (length > 8) throw new Error('Invalid vint length');
    }
    let value = keepMask ? first : (first & (mask - 1));
    for (let i = 1; i < length; i++) {
      value = value * 256 + this.buf[this.pos + i];
    }
    this.pos += length;
    return value;
  }

  readBytes(n: number): Uint8Array {
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }

  readUint(n: number): number {
    let v = 0;
    for (let i = 0; i < n; i++) v = v * 256 + this.buf[this.pos + i];
    this.pos += n;
    return v;
  }

  skip(n: number) { this.pos += n; }
}

// EBML element IDs we care about (with the leading length bit kept)
const ID_SEGMENT = 0x18538067;
const ID_CLUSTER = 0x1F43B675;
const ID_TIMECODE = 0xE7;
const ID_SIMPLEBLOCK = 0xA3;
const ID_BLOCKGROUP = 0xA0;
const ID_BLOCK = 0xA1;
const ID_TRACKS = 0x1654AE6B;
const ID_TRACKENTRY = 0xAE;
const ID_CODECID = 0x86;
const ID_CODECPRIVATE = 0x63A2;
const ID_AUDIO = 0xE1;
const ID_SAMPLINGFREQUENCY = 0xB5;
const ID_CHANNELS = 0x9F;

interface ParsedWebm {
  opusHead: Uint8Array | null;
  sampleRate: number;
  channels: number;
  /** Each entry is one Opus packet (one TOC + frames). */
  packets: Uint8Array[];
}

function parseWebm(buf: Uint8Array): ParsedWebm {
  const reader = new EbmlReader(buf);
  const result: ParsedWebm = { opusHead: null, sampleRate: 48000, channels: 1, packets: [] };

  // Walk top-level elements
  while (!reader.eof) {
    const id = reader.readVint(true);
    if (id < 0) break;
    const size = reader.readVint(false);
    if (id === ID_SEGMENT) {
      // Recurse into segment
      parseSegment(new EbmlReader(reader.readBytes(size)), result);
    } else {
      reader.skip(size);
    }
  }

  return result;
}

function parseSegment(reader: EbmlReader, result: ParsedWebm) {
  while (!reader.eof) {
    const id = reader.readVint(true);
    if (id < 0) break;
    const size = reader.readVint(false);
    const elementBytes = reader.readBytes(size);

    if (id === ID_TRACKS) {
      parseTracks(new EbmlReader(elementBytes), result);
    } else if (id === ID_CLUSTER) {
      parseCluster(new EbmlReader(elementBytes), result);
    }
    // ignore other top-level segment elements (SeekHead, Info, Cues, etc.)
  }
}

function parseTracks(reader: EbmlReader, result: ParsedWebm) {
  while (!reader.eof) {
    const id = reader.readVint(true);
    if (id < 0) break;
    const size = reader.readVint(false);
    const bytes = reader.readBytes(size);
    if (id === ID_TRACKENTRY) {
      parseTrackEntry(new EbmlReader(bytes), result);
    }
  }
}

function parseTrackEntry(reader: EbmlReader, result: ParsedWebm) {
  while (!reader.eof) {
    const id = reader.readVint(true);
    if (id < 0) break;
    const size = reader.readVint(false);
    if (id === ID_CODECPRIVATE) {
      result.opusHead = new Uint8Array(reader.readBytes(size));
    } else if (id === ID_AUDIO) {
      const audio = new EbmlReader(reader.readBytes(size));
      while (!audio.eof) {
        const aid = audio.readVint(true);
        if (aid < 0) break;
        const asize = audio.readVint(false);
        if (aid === ID_SAMPLINGFREQUENCY) {
          // float
          if (asize === 4) {
            const dv = new DataView(audio.buf.buffer, audio.buf.byteOffset + audio.position, 4);
            result.sampleRate = Math.round(dv.getFloat32(0));
            audio.skip(4);
          } else if (asize === 8) {
            const dv = new DataView(audio.buf.buffer, audio.buf.byteOffset + audio.position, 8);
            result.sampleRate = Math.round(dv.getFloat64(0));
            audio.skip(8);
          } else {
            audio.skip(asize);
          }
        } else if (aid === ID_CHANNELS) {
          result.channels = audio.readUint(asize);
        } else {
          audio.skip(asize);
        }
      }
    } else {
      reader.skip(size);
    }
  }
}

function parseCluster(reader: EbmlReader, result: ParsedWebm) {
  while (!reader.eof) {
    const id = reader.readVint(true);
    if (id < 0) break;
    const size = reader.readVint(false);
    if (id === ID_TIMECODE) {
      reader.skip(size);
    } else if (id === ID_SIMPLEBLOCK) {
      const block = reader.readBytes(size);
      const packet = extractBlockPayload(block);
      if (packet) result.packets.push(packet);
    } else if (id === ID_BLOCKGROUP) {
      const group = new EbmlReader(reader.readBytes(size));
      while (!group.eof) {
        const gid = group.readVint(true);
        if (gid < 0) break;
        const gsize = group.readVint(false);
        if (gid === ID_BLOCK) {
          const block = group.readBytes(gsize);
          const packet = extractBlockPayload(block);
          if (packet) result.packets.push(packet);
        } else {
          group.skip(gsize);
        }
      }
    } else {
      reader.skip(size);
    }
  }
}

/** Strip the Block/SimpleBlock header (track number vint + 2-byte timecode + 1-byte flags). */
function extractBlockPayload(block: Uint8Array): Uint8Array | null {
  if (block.length < 4) return null;
  // Read track number vint
  const reader = new EbmlReader(block);
  reader.readVint(false);
  reader.skip(3); // timecode (2) + flags (1)
  return block.subarray(reader.position);
}

// ---------- OGG container building ----------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = ((r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1)) >>> 0;
    }
    table[i] = r >>> 0;
  }
  return table;
})();

function oggCrc(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ data[i]) & 0xff]) >>> 0;
  }
  return crc >>> 0;
}

function buildOggPage(opts: {
  headerType: number;
  granulePosition: number;
  serial: number;
  pageSeq: number;
  segments: Uint8Array[];
}): Uint8Array {
  const { headerType, granulePosition, serial, pageSeq, segments } = opts;

  // Build segment table (one or more lacing values per segment)
  const lacing: number[] = [];
  for (const seg of segments) {
    let remaining = seg.length;
    if (remaining === 0) {
      lacing.push(0);
      continue;
    }
    while (remaining >= 255) {
      lacing.push(255);
      remaining -= 255;
    }
    lacing.push(remaining);
  }
  if (lacing.length > 255) {
    throw new Error('Too many lacing values for a single OGG page');
  }

  const payload = segments.reduce((sum, s) => sum + s.length, 0);
  const headerSize = 27 + lacing.length;
  const page = new Uint8Array(headerSize + payload);
  const dv = new DataView(page.buffer);

  page[0] = 0x4f; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53; // "OggS"
  page[4] = 0; // stream version
  page[5] = headerType;
  // granule position (64-bit little-endian) — JS bitwise is 32-bit, write as two 32-bit halves
  const lo = granulePosition >>> 0;
  const hi = Math.floor(granulePosition / 0x100000000) >>> 0;
  dv.setUint32(6, lo, true);
  dv.setUint32(10, hi, true);
  dv.setUint32(14, serial >>> 0, true);
  dv.setUint32(18, pageSeq >>> 0, true);
  dv.setUint32(22, 0, true); // CRC placeholder
  page[26] = lacing.length;
  for (let i = 0; i < lacing.length; i++) page[27 + i] = lacing[i];

  let offset = headerSize;
  for (const seg of segments) {
    page.set(seg, offset);
    offset += seg.length;
  }

  const crc = oggCrc(page);
  dv.setUint32(22, crc, true);
  return page;
}

const TEXT = new TextEncoder();

function defaultOpusHead(channels: number, sampleRate: number): Uint8Array {
  const head = new Uint8Array(19);
  head.set(TEXT.encode('OpusHead'), 0);
  head[8] = 1; // version
  head[9] = channels;
  // pre-skip (16 LE) — 3840 samples is a safe default
  head[10] = 0x00; head[11] = 0x0f;
  // input sample rate (32 LE)
  const dv = new DataView(head.buffer);
  dv.setUint32(12, sampleRate >>> 0, true);
  // output gain (16 LE) = 0
  head[16] = 0; head[17] = 0;
  head[18] = 0; // channel mapping family = 0 (mono/stereo)
  return head;
}

function buildOpusTags(): Uint8Array {
  const vendor = TEXT.encode('lovable-remux');
  const tags = new Uint8Array(8 + 4 + vendor.length + 4);
  tags.set(TEXT.encode('OpusTags'), 0);
  const dv = new DataView(tags.buffer);
  dv.setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  dv.setUint32(12 + vendor.length, 0, true); // user comment list length = 0
  return tags;
}

/** Get number of samples encoded by an Opus packet (all values at 48kHz). */
function opusPacketSamples(packet: Uint8Array): number {
  if (packet.length < 1) return 960;
  const toc = packet[0];
  const config = toc >> 3;
  // Frame duration table for each config (microseconds)
  // Configs 0-11: SILK / Hybrid (10/20/40/60 ms). Configs 12-15: CELT (10/20). Configs 16-19: 2.5/5/10/20 ms.
  const frameDurUs = [
    10000, 20000, 40000, 60000, // 0-3 SILK NB
    10000, 20000, 40000, 60000, // 4-7 SILK MB
    10000, 20000, 40000, 60000, // 8-11 SILK WB
    10000, 20000,               // 12-13 Hybrid SWB
    10000, 20000,               // 14-15 Hybrid FB
    2500, 5000, 10000, 20000,   // 16-19 CELT NB
    2500, 5000, 10000, 20000,   // 20-23 CELT WB
    2500, 5000, 10000, 20000,   // 24-27 CELT SWB
    2500, 5000, 10000, 20000,   // 28-31 CELT FB
  ];
  const code = toc & 0x3;
  const frames = code === 0 ? 1 : code === 1 ? 2 : code === 2 ? 2 : (packet.length > 1 ? (packet[1] & 0x3F) : 1);
  const dur = frameDurUs[config] || 20000;
  return Math.round((dur * frames * 48) / 1000); // samples at 48 kHz
}

/** Wrap raw Opus packets in an OGG container. */
function packetsToOgg(packets: Uint8Array[], opusHead: Uint8Array): Blob {
  const serial = (Math.random() * 0xffffffff) >>> 0;
  const chunks: Uint8Array[] = [];
  let pageSeq = 0;

  // Page 0: OpusHead (BOS)
  chunks.push(buildOggPage({
    headerType: 0x02,
    granulePosition: 0,
    serial,
    pageSeq: pageSeq++,
    segments: [opusHead],
  }));

  // Page 1: OpusTags
  chunks.push(buildOggPage({
    headerType: 0x00,
    granulePosition: 0,
    serial,
    pageSeq: pageSeq++,
    segments: [buildOpusTags()],
  }));

  // Audio pages — group packets per page, capping segment count and payload
  let granule = 0;
  let i = 0;
  const MAX_SEGMENTS_PER_PAGE = 64;
  const MAX_PACKET_BYTES_PER_PAGE = 32 * 1024;

  while (i < packets.length) {
    const segs: Uint8Array[] = [];
    let bytes = 0;
    while (
      i < packets.length &&
      segs.length < MAX_SEGMENTS_PER_PAGE &&
      bytes + packets[i].length < MAX_PACKET_BYTES_PER_PAGE &&
      // any single packet that needs > 255 lacing values must be alone in a page
      Math.ceil(packets[i].length / 255) + 1 <= 255
    ) {
      segs.push(packets[i]);
      bytes += packets[i].length;
      granule += opusPacketSamples(packets[i]);
      i++;
    }
    if (segs.length === 0) {
      // single oversized packet — emit it alone (very rare for short voice notes)
      segs.push(packets[i]);
      granule += opusPacketSamples(packets[i]);
      i++;
    }
    const isLast = i >= packets.length;
    chunks.push(buildOggPage({
      headerType: isLast ? 0x04 : 0x00,
      granulePosition: granule,
      serial,
      pageSeq: pageSeq++,
      segments: segs,
    }));
  }

  return new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
}

// ---------- Public API ----------

/**
 * Convert a WebM/Opus Blob (from MediaRecorder) into a true OGG/Opus Blob.
 * Returns the original blob if it's already OGG or if remuxing fails.
 */
export async function webmBlobToOggOpus(input: Blob): Promise<Blob> {
  try {
    const buf = new Uint8Array(await input.arrayBuffer());

    // Already OGG? ("OggS" magic at byte 0)
    if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
      return new Blob([buf], { type: 'audio/ogg; codecs=opus' });
    }

    // Quick sanity check: WebM EBML header starts with 0x1A 0x45 0xDF 0xA3
    if (buf.length < 4 || buf[0] !== 0x1a || buf[1] !== 0x45 || buf[2] !== 0xdf || buf[3] !== 0xa3) {
      // Not WebM — return as-is
      return input;
    }

    const parsed = parseWebm(buf);
    if (parsed.packets.length === 0) {
      console.warn('[webmToOgg] no Opus packets found in WebM, returning original');
      return input;
    }

    const opusHead = parsed.opusHead && parsed.opusHead.length >= 19
      ? parsed.opusHead
      : defaultOpusHead(parsed.channels || 1, parsed.sampleRate || 48000);

    return packetsToOgg(parsed.packets, opusHead);
  } catch (err) {
    console.error('[webmToOgg] remux failed, falling back to original blob:', err);
    return input;
  }
}
