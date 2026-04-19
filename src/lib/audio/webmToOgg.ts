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
 * IMPORTANT: MediaRecorder typically emits the top-level Segment element (and
 * sometimes Cluster elements) with an "unknown size" marker. The parser must
 * detect this and stream-parse children until the buffer ends or the next
 * top-level element starts, instead of trying to read a giant size value.
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
  get remaining() { return this.buf.length - this.pos; }
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

  /**
   * Read element size, returning -1 if it's the "unknown size" sentinel
   * (all data bits set to 1).
   */
  readSize(): number {
    if (this.pos >= this.buf.length) return -1;
    const first = this.buf[this.pos];
    if (first === 0) throw new Error('Invalid size vint');
    let length = 1;
    let mask = 0x80;
    while (!(first & mask)) {
      length++;
      mask >>= 1;
      if (length > 8) throw new Error('Invalid size vint length');
    }
    let value = first & (mask - 1);
    let allOnes = value === (mask - 1);
    for (let i = 1; i < length; i++) {
      const b = this.buf[this.pos + i];
      if (b !== 0xff) allOnes = false;
      value = value * 256 + b;
    }
    this.pos += length;
    return allOnes ? -1 : value;
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
const ID_EBML = 0x1A45DFA3;
const ID_SEGMENT = 0x18538067;
const ID_SEEKHEAD = 0x114D9B74;
const ID_INFO = 0x1549A966;
const ID_CUES = 0x1C53BB6B;
const ID_CLUSTER = 0x1F43B675;
const ID_TIMECODE = 0xE7;
const ID_SIMPLEBLOCK = 0xA3;
const ID_BLOCKGROUP = 0xA0;
const ID_BLOCK = 0xA1;
const ID_TRACKS = 0x1654AE6B;
const ID_TRACKENTRY = 0xAE;
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

/** Top-level master IDs that may indicate end of a parent with unknown size. */
const TOP_LEVEL_IDS = new Set<number>([
  ID_EBML, ID_SEGMENT, ID_SEEKHEAD, ID_INFO, ID_CLUSTER, ID_TRACKS, ID_CUES,
]);

function parseWebm(buf: Uint8Array): ParsedWebm {
  const reader = new EbmlReader(buf);
  const result: ParsedWebm = { opusHead: null, sampleRate: 48000, channels: 1, packets: [] };

  while (!reader.eof) {
    const id = safeReadId(reader);
    if (id < 0) break;
    const size = reader.readSize();
    if (id === ID_SEGMENT) {
      // Segment is almost always unknown-size from MediaRecorder.
      // Parse its children directly from the same buffer position.
      parseSegmentStreaming(reader, result, size);
    } else if (size < 0) {
      // Unknown size on a top-level non-segment — bail.
      break;
    } else {
      reader.skip(size);
    }
  }

  return result;
}

function safeReadId(reader: EbmlReader): number {
  try {
    return reader.readVint(true);
  } catch {
    return -1;
  }
}

/**
 * Parse Segment children. If `size` is -1 (unknown), read until EOF.
 * Otherwise read up to `start + size`.
 */
function parseSegmentStreaming(reader: EbmlReader, result: ParsedWebm, size: number) {
  const end = size < 0 ? reader.buf.length : Math.min(reader.position + size, reader.buf.length);
  while (reader.position < end) {
    const id = safeReadId(reader);
    if (id < 0) break;
    const childSize = reader.readSize();
    if (id === ID_TRACKS) {
      if (childSize < 0) break; // Tracks should always have a known size.
      const bytes = reader.readBytes(childSize);
      parseTracks(new EbmlReader(bytes), result);
    } else if (id === ID_CLUSTER) {
      parseClusterStreaming(reader, result, childSize, end);
    } else {
      if (childSize < 0) {
        // Skip unknown-size element by scanning ahead for next known top-level ID.
        skipUnknownSize(reader, end);
      } else {
        reader.skip(Math.min(childSize, end - reader.position));
      }
    }
  }
}

function parseTracks(reader: EbmlReader, result: ParsedWebm) {
  while (!reader.eof) {
    const id = safeReadId(reader);
    if (id < 0) break;
    const size = reader.readSize();
    if (size < 0) break;
    const bytes = reader.readBytes(size);
    if (id === ID_TRACKENTRY) {
      parseTrackEntry(new EbmlReader(bytes), result);
    }
  }
}

function parseTrackEntry(reader: EbmlReader, result: ParsedWebm) {
  while (!reader.eof) {
    const id = safeReadId(reader);
    if (id < 0) break;
    const size = reader.readSize();
    if (size < 0) break;
    if (id === ID_CODECPRIVATE) {
      result.opusHead = new Uint8Array(reader.readBytes(size));
    } else if (id === ID_AUDIO) {
      const audio = new EbmlReader(reader.readBytes(size));
      while (!audio.eof) {
        const aid = safeReadId(audio);
        if (aid < 0) break;
        const asize = audio.readSize();
        if (asize < 0) break;
        if (aid === ID_SAMPLINGFREQUENCY) {
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

/**
 * Parse Cluster children. Cluster size is often -1 (unknown) from MediaRecorder.
 * In that case, read until we hit another top-level ID or `end`.
 */
function parseClusterStreaming(reader: EbmlReader, result: ParsedWebm, size: number, parentEnd: number) {
  const end = size < 0 ? parentEnd : Math.min(reader.position + size, parentEnd);
  while (reader.position < end) {
    const idStart = reader.position;
    const id = safeReadId(reader);
    if (id < 0) break;

    // If we encounter another top-level ID inside an unknown-size cluster,
    // it means the cluster ended — rewind and let the parent handle it.
    if (size < 0 && TOP_LEVEL_IDS.has(id)) {
      reader.seek(idStart);
      return;
    }

    const childSize = reader.readSize();
    if (id === ID_TIMECODE) {
      if (childSize < 0) break;
      reader.skip(childSize);
    } else if (id === ID_SIMPLEBLOCK) {
      if (childSize < 0 || childSize > reader.remaining) break;
      const block = reader.readBytes(childSize);
      const packet = extractBlockPayload(block);
      if (packet) result.packets.push(packet);
    } else if (id === ID_BLOCKGROUP) {
      if (childSize < 0 || childSize > reader.remaining) break;
      const group = new EbmlReader(reader.readBytes(childSize));
      while (!group.eof) {
        const gid = safeReadId(group);
        if (gid < 0) break;
        const gsize = group.readSize();
        if (gsize < 0) break;
        if (gid === ID_BLOCK) {
          const block = group.readBytes(gsize);
          const packet = extractBlockPayload(block);
          if (packet) result.packets.push(packet);
        } else {
          group.skip(gsize);
        }
      }
    } else {
      if (childSize < 0) {
        skipUnknownSize(reader, end);
      } else {
        reader.skip(Math.min(childSize, end - reader.position));
      }
    }
  }
}

/** Scan forward byte-by-byte until we find a known top-level ID, or hit end. */
function skipUnknownSize(reader: EbmlReader, end: number) {
  while (reader.position < end - 4) {
    const b0 = reader.buf[reader.position];
    const b1 = reader.buf[reader.position + 1];
    const b2 = reader.buf[reader.position + 2];
    const b3 = reader.buf[reader.position + 3];
    const id4 = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
    if (TOP_LEVEL_IDS.has(id4)) return;
    reader.skip(1);
  }
  reader.seek(end);
}

/** Strip the Block/SimpleBlock header (track number vint + 2-byte timecode + 1-byte flags). */
function extractBlockPayload(block: Uint8Array): Uint8Array | null {
  if (block.length < 4) return null;
  const reader = new EbmlReader(block);
  try {
    reader.readVint(false);
  } catch {
    return null;
  }
  reader.skip(3);
  if (reader.position >= block.length) return null;
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
  page[4] = 0;
  page[5] = headerType;
  const lo = granulePosition >>> 0;
  const hi = Math.floor(granulePosition / 0x100000000) >>> 0;
  dv.setUint32(6, lo, true);
  dv.setUint32(10, hi, true);
  dv.setUint32(14, serial >>> 0, true);
  dv.setUint32(18, pageSeq >>> 0, true);
  dv.setUint32(22, 0, true);
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
  head[8] = 1;
  head[9] = channels;
  head[10] = 0x00; head[11] = 0x0f;
  const dv = new DataView(head.buffer);
  dv.setUint32(12, sampleRate >>> 0, true);
  head[16] = 0; head[17] = 0;
  head[18] = 0;
  return head;
}

function buildOpusTags(): Uint8Array {
  const vendor = TEXT.encode('lovable-remux');
  const tags = new Uint8Array(8 + 4 + vendor.length + 4);
  tags.set(TEXT.encode('OpusTags'), 0);
  const dv = new DataView(tags.buffer);
  dv.setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  dv.setUint32(12 + vendor.length, 0, true);
  return tags;
}

function opusPacketSamples(packet: Uint8Array): number {
  if (packet.length < 1) return 960;
  const toc = packet[0];
  const config = toc >> 3;
  const frameDurUs = [
    10000, 20000, 40000, 60000,
    10000, 20000, 40000, 60000,
    10000, 20000, 40000, 60000,
    10000, 20000,
    10000, 20000,
    2500, 5000, 10000, 20000,
    2500, 5000, 10000, 20000,
    2500, 5000, 10000, 20000,
    2500, 5000, 10000, 20000,
  ];
  const code = toc & 0x3;
  const frames = code === 0 ? 1 : code === 1 ? 2 : code === 2 ? 2 : (packet.length > 1 ? (packet[1] & 0x3F) : 1);
  const dur = frameDurUs[config] || 20000;
  return Math.round((dur * frames * 48) / 1000);
}

function packetsToOgg(packets: Uint8Array[], opusHead: Uint8Array): Blob {
  const serial = (Math.random() * 0xffffffff) >>> 0;
  const chunks: Uint8Array[] = [];
  let pageSeq = 0;

  chunks.push(buildOggPage({
    headerType: 0x02,
    granulePosition: 0,
    serial,
    pageSeq: pageSeq++,
    segments: [opusHead],
  }));

  chunks.push(buildOggPage({
    headerType: 0x00,
    granulePosition: 0,
    serial,
    pageSeq: pageSeq++,
    segments: [buildOpusTags()],
  }));

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
      Math.ceil(packets[i].length / 255) + 1 <= 255
    ) {
      segs.push(packets[i]);
      bytes += packets[i].length;
      granule += opusPacketSamples(packets[i]);
      i++;
    }
    if (segs.length === 0) {
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

  return new Blob(chunks as BlobPart[], { type: 'audio/ogg; codecs=opus' });
}

// ---------- Public API ----------

export interface RemuxResult {
  blob: Blob;
  packets: number;
  approxDurationMs: number;
}

/**
 * Convert a WebM/Opus Blob (from MediaRecorder) into a true OGG/Opus Blob.
 * Throws if the input cannot be remuxed into a valid container with audio packets.
 */
export async function webmBlobToOggOpusStrict(input: Blob): Promise<RemuxResult> {
  const buf = new Uint8Array(await input.arrayBuffer());

  // Already OGG?
  if (buf.length >= 4 && buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return { blob: new Blob([buf], { type: 'audio/ogg; codecs=opus' }), packets: -1, approxDurationMs: -1 };
  }

  if (buf.length < 4 || buf[0] !== 0x1a || buf[1] !== 0x45 || buf[2] !== 0xdf || buf[3] !== 0xa3) {
    throw new Error('Entrada não é WebM nem OGG.');
  }

  const parsed = parseWebm(buf);
  if (parsed.packets.length === 0) {
    throw new Error('Nenhum pacote Opus encontrado no WebM gravado.');
  }

  const opusHead = parsed.opusHead && parsed.opusHead.length >= 19
    ? parsed.opusHead
    : defaultOpusHead(parsed.channels || 1, parsed.sampleRate || 48000);

  const totalSamples = parsed.packets.reduce((s, p) => s + opusPacketSamples(p), 0);
  const approxDurationMs = Math.round(totalSamples / 48); // 48kHz

  const blob = packetsToOgg(parsed.packets, opusHead);
  return { blob, packets: parsed.packets.length, approxDurationMs };
}

/**
 * Backwards-compatible wrapper. Returns the original blob on failure.
 * Prefer `webmBlobToOggOpusStrict` when you need to fail loudly.
 */
export async function webmBlobToOggOpus(input: Blob): Promise<Blob> {
  try {
    const { blob } = await webmBlobToOggOpusStrict(input);
    return blob;
  } catch (err) {
    console.error('[webmToOgg] remux failed, falling back to original blob:', err);
    return input;
  }
}
