import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push crypto utilities for Deno
async function generatePushPayload(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
) {
  // Use web-push via npm for Deno
  // Since web-push is complex to implement from scratch, we'll use the fetch API
  // with the VAPID authorization header approach
  
  const { endpoint, p256dh, auth } = subscription;
  
  // Build JWT for VAPID
  const vapidJwt = await createVapidJwt(endpoint, vapidKeys);
  
  // Encrypt payload
  const encrypted = await encryptPayload(payload, p256dh, auth);
  
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${vapidJwt}, k=${vapidKeys.publicKey}`,
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "TTL": "86400",
    },
    body: encrypted,
  });
  
  return response;
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidJwt(endpoint: string, vapidKeys: { publicKey: string; privateKey: string; subject: string }): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: vapidKeys.subject,
  };
  
  const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  
  // Import private key
  const privateKeyBytes = base64UrlDecode(vapidKeys.privateKey);
  
  // Build raw PKCS8 from the 32-byte private key
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: vapidKeys.privateKey,
    x: base64UrlEncode(base64UrlDecode(vapidKeys.publicKey).slice(1, 33)),
    y: base64UrlEncode(base64UrlDecode(vapidKeys.publicKey).slice(33, 65)),
  };
  
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );
  
  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // DER format: parse r and s
    const r = parseDerInt(sigBytes, 3);
    const sOffset = 3 + sigBytes[3] + 2;
    const s = parseDerInt(sigBytes, sOffset);
    rawSig = new Uint8Array(64);
    rawSig.set(padTo32(r), 0);
    rawSig.set(padTo32(s), 32);
  }
  
  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function parseDerInt(buf: Uint8Array, offset: number): Uint8Array {
  const len = buf[offset];
  return buf.slice(offset + 1, offset + 1 + len);
}

function padTo32(buf: Uint8Array): Uint8Array {
  if (buf.length === 32) return buf;
  if (buf.length > 32) return buf.slice(buf.length - 32);
  const padded = new Uint8Array(32);
  padded.set(buf, 32 - buf.length);
  return padded;
}

async function encryptPayload(payload: string, p256dhKey: string, authSecret: string): Promise<Uint8Array> {
  const clientPublicKey = base64UrlDecode(p256dhKey);
  const clientAuth = base64UrlDecode(authSecret);
  
  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  
  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  
  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeyPair.privateKey,
      256
    )
  );
  
  // Export local public key
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );
  
  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // HKDF for auth info
  const authInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...clientPublicKey,
    ...localPublicKeyRaw,
  ]);
  
  const prkKey = await crypto.subtle.importKey("raw", clientAuth as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, sharedSecret));
  
  // IKM
  const ikmInfo = new Uint8Array([...authInfo, 1]);
  const ikmKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ikm = new Uint8Array(await crypto.subtle.sign("HMAC", ikmKey, ikmInfo));
  
  // Derive content encryption key and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  
  const saltKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prkCek = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm));
  
  const prkCekKey = await crypto.subtle.importKey("raw", prkCek, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const cekFull = new Uint8Array(await crypto.subtle.sign("HMAC", prkCekKey, new Uint8Array([...cekInfo, 1])));
  const cek = cekFull.slice(0, 16);
  
  const nonceFull = new Uint8Array(await crypto.subtle.sign("HMAC", prkCekKey, new Uint8Array([...nonceInfo, 1])));
  const nonce = nonceFull.slice(0, 12);
  
  // Encrypt with AES-128-GCM
  const encKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  
  const paddedPayload = new Uint8Array([...new TextEncoder().encode(payload), 2]); // delimiter
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, encKey, paddedPayload)
  );
  
  // Build aes128gcm header
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, paddedPayload.length + 16 + 1);
  
  const header = new Uint8Array([
    ...salt,
    ...recordSize,
    localPublicKeyRaw.length,
    ...localPublicKeyRaw,
  ]);
  
  const result = new Uint8Array(header.length + encrypted.length);
  result.set(header);
  result.set(encrypted, header.length);
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();

    let title: string;
    let bodyText: string;
    let url: string | undefined;
    let icon: string | undefined;
    let targetType = "all";
    let targetValue: string | undefined;
    let notificationId: string | undefined;

    if (body.notificationId) {
      notificationId = body.notificationId;
      const { data: notif, error } = await supabase
        .from("push_notifications")
        .select("*")
        .eq("id", notificationId)
        .single();
      if (error || !notif) throw new Error("Notification not found");
      title = notif.title;
      bodyText = notif.body;
      url = notif.url;
      icon = notif.icon;
      targetType = notif.target_type;
      targetValue = notif.target_value;

      await supabase
        .from("push_notifications")
        .update({ status: "sending" })
        .eq("id", notificationId);
    } else {
      title = body.title;
      bodyText = body.body;
      url = body.url;
      icon = body.icon;
      targetType = body.targetType || "all";
      targetValue = body.targetValue;
    }

    // Get target user_ids
    let userIds: number[] | null = null;

    if (targetType === "user" && targetValue) {
      userIds = [parseInt(targetValue)];
    } else if ((targetType === "role" || targetType === "cod_agent") && targetValue) {
      // Query external DB to resolve user_ids
      const EXTERNAL_DB_URL = Deno.env.get("EXTERNAL_DB_URL");
      if (EXTERNAL_DB_URL) {
        const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
        const sql = postgres(EXTERNAL_DB_URL, { ssl: { rejectUnauthorized: false } });
        try {
          let rows: any[];
          if (targetType === "role") {
            rows = await sql`SELECT id FROM users WHERE role = ${targetValue}`;
          } else {
            rows = await sql`SELECT DISTINCT user_id as id FROM user_agents WHERE cod_agent = ${targetValue}`;
          }
          userIds = rows.map((r: any) => r.id);
        } finally {
          await sql.end();
        }
      }
    }

    // Fetch subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    if (userIds) {
      query = query.in("user_id", userIds);
    }
    const { data: subscriptions, error: subError } = await query;
    if (subError) throw subError;

    const payload = JSON.stringify({ title, body: bodyText, url, icon });
    const vapidKeys = {
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
      subject: VAPID_SUBJECT,
    };

    let sentCount = 0;
    let errorCount = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions || []) {
      try {
        const response = await generatePushPayload(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidKeys
        );

        if (response.status === 201 || response.status === 200) {
          sentCount++;
        } else if (response.status === 404 || response.status === 410) {
          expiredEndpoints.push(sub.endpoint);
          errorCount++;
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${response.status}`);
          errorCount++;
        }
      } catch (err) {
        console.error(`Push error for ${sub.endpoint}:`, err);
        errorCount++;
      }
    }

    // Remove expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    // Update notification record
    if (notificationId) {
      await supabase
        .from("push_notifications")
        .update({
          status: "sent",
          sent_count: sentCount,
          error_count: errorCount,
          sent_at: new Date().toISOString(),
        })
        .eq("id", notificationId);
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, errors: errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error)?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
