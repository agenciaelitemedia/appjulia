import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TIMEOUT_MS = 5000;
const MAX_BYTES = 1_000_000;

interface PreviewResult {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  site_name?: string | null;
  domain?: string | null;
}

function normalizeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    return u;
  } catch {
    return null;
  }
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function extractMeta(html: string, url: URL): PreviewResult {
  const out: PreviewResult = { url: url.toString(), domain: url.hostname.replace(/^www\./, '') };

  const metaRe = /<meta\s+[^>]*>/gi;
  const attrRe = /(\w[\w:-]*)\s*=\s*("([^"]*)"|'([^']*)')/gi;

  const getAttrs = (tag: string): Record<string, string> => {
    const m: Record<string, string> = {};
    let a: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(tag)) !== null) {
      m[a[1].toLowerCase()] = a[3] ?? a[4] ?? '';
    }
    return m;
  };

  const metas: Record<string, string> = {};
  let mt: RegExpExecArray | null;
  while ((mt = metaRe.exec(html)) !== null) {
    const attrs = getAttrs(mt[0]);
    const key = (attrs.property || attrs.name || attrs.itemprop || '').toLowerCase();
    const content = attrs.content;
    if (key && content && !metas[key]) metas[key] = content;
  }

  out.title = metas['og:title'] || metas['twitter:title'] || null;
  out.description = metas['og:description'] || metas['twitter:description'] || metas['description'] || null;
  out.image = metas['og:image'] || metas['og:image:url'] || metas['twitter:image'] || metas['twitter:image:src'] || null;
  out.site_name = metas['og:site_name'] || null;

  if (!out.title) {
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (tm) out.title = tm[1].replace(/\s+/g, ' ').trim();
  }

  if (out.image) {
    try { out.image = new URL(out.image, url).toString(); } catch { /* ignore */ }
  }

  const decode = (s: string | null | undefined) =>
    s ? s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
         .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
      : s;
  out.title = decode(out.title)?.slice(0, 300) || null;
  out.description = decode(out.description)?.slice(0, 500) || null;

  return out;
}

async function fetchHtml(url: URL): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0; +https://atendejulia.com.br)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.6',
      },
    });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('text/html') && !ct.includes('application/xhtml')) return null;

    const reader = resp.body?.getReader();
    if (!reader) return await resp.text();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
        if (total >= MAX_BYTES) { try { await reader.cancel(); } catch { /* ignore */ } break; }
      }
    }
    const buf = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { buf.set(c, off); off += c.length; }
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawUrl = typeof body?.url === 'string' ? body.url : '';
    const u = normalizeUrl(rawUrl);
    if (!u) {
      return new Response(JSON.stringify({ error: 'invalid_url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const urlStr = u.toString();
    const urlHash = await sha256Hex(urlStr);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: cached } = await admin
      .from('link_preview_cache')
      .select('*')
      .eq('url_hash', urlHash)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return new Response(JSON.stringify({
        url: cached.url,
        title: cached.title,
        description: cached.description,
        image: cached.image_url,
        site_name: cached.site_name,
        domain: cached.domain,
        cached: true,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const html = await fetchHtml(u);
    if (!html) {
      return new Response(JSON.stringify({ url: urlStr, error: 'fetch_failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const preview = extractMeta(html, u);

    await admin.from('link_preview_cache').upsert({
      url_hash: urlHash,
      url: urlStr,
      title: preview.title,
      description: preview.description,
      image_url: preview.image,
      site_name: preview.site_name,
      domain: preview.domain,
      fetched_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'url_hash' });

    return new Response(JSON.stringify({ ...preview, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});