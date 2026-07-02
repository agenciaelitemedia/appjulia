// Simple image proxy that fetches remote images server-side and streams
// them back. Used to bypass Meta CDN's expiring/referrer-signed URLs for
// campaign thumbnails (scontent.*.fbcdn.net).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = new URL(req.url).searchParams.get("url");
    if (!url) return new Response("missing url", { status: 400, headers: corsHeaders });
    let target: URL;
    try { target = new URL(url); } catch { return new Response("invalid url", { status: 400, headers: corsHeaders }); }
    if (!/^https?:$/.test(target.protocol)) {
      return new Response("bad protocol", { status: 400, headers: corsHeaders });
    }
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LovableImageProxy/1.0)",
        "Accept": "image/*,*/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!upstream.ok) {
      return new Response(`upstream ${upstream.status}`, { status: 502, headers: corsHeaders });
    }
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    return new Response(upstream.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    return new Response(`proxy error: ${(e as Error).message}`, { status: 500, headers: corsHeaders });
  }
});
