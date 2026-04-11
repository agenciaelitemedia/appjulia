// ============================================
// WebChat API Edge Function
// Handles webchat widget communication:
// - GET ?action=config&agent=XXX → returns widget config
// - POST action=init → creates session + contact + conversation
// - POST action=send → sends message from visitor
// - POST action=history → returns messages for session
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Get widget config (public) ──────────────────────────────────
async function getConfig(codAgent: string) {
  const { data, error } = await supabase
    .from('webchat_config')
    .select('*')
    .eq('cod_agent', codAgent)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data) {
    return json({ error: 'Widget not configured' }, 404);
  }

  return json({
    widget_title: data.widget_title,
    welcome_message: data.welcome_message,
    primary_color: data.primary_color,
    logo_url: data.logo_url,
    position: data.position,
    collect_email: data.collect_email,
    collect_name: data.collect_name,
    offline_message: data.offline_message,
    auto_open_delay_seconds: data.auto_open_delay_seconds,
  });
}

// ─── Init session → create contact + conversation ────────────────
async function initSession(body: any) {
  const { cod_agent, client_id, visitor_id, visitor_name, visitor_email } = body;

  if (!cod_agent || !client_id || !visitor_id) {
    return json({ error: 'cod_agent, client_id and visitor_id are required' }, 400);
  }

  // Check existing active session
  const { data: existing } = await supabase
    .from('webchat_sessions')
    .select('*, contact_id, conversation_id')
    .eq('visitor_id', visitor_id)
    .eq('cod_agent', cod_agent)
    .eq('status', 'active')
    .limit(1)
    .single();

  if (existing?.contact_id && existing?.conversation_id) {
    return json({
      session_id: existing.id,
      contact_id: existing.contact_id,
      conversation_id: existing.conversation_id,
    });
  }

  // Create/upsert contact
  const contactPhone = `webchat_${visitor_id}`;
  const contactName = visitor_name || `Visitante ${visitor_id.slice(0, 6)}`;

  const { data: contact, error: contactErr } = await supabase
    .from('chat_contacts')
    .upsert(
      {
        phone: contactPhone,
        client_id,
        cod_agent,
        name: contactName,
        channel_type: 'webchat',
        channel_source: 'webchat',
        last_message_at: new Date().toISOString(),
      },
      { onConflict: 'phone,client_id' }
    )
    .select('id')
    .single();

  if (contactErr || !contact) {
    console.error('[webchat-api] contact upsert error:', contactErr);
    return json({ error: 'Failed to create contact' }, 500);
  }

  // Create conversation
  const { data: conv, error: convErr } = await supabase
    .from('chat_conversations')
    .insert({
      contact_id: contact.id,
      client_id,
      cod_agent,
      channel: 'webchat',
      status: 'pending',
    })
    .select('id, protocol')
    .single();

  if (convErr || !conv) {
    console.error('[webchat-api] conversation create error:', convErr);
    return json({ error: 'Failed to create conversation' }, 500);
  }

  // Create/update session
  const { data: session } = await supabase
    .from('webchat_sessions')
    .upsert(
      {
        cod_agent,
        client_id,
        visitor_id,
        visitor_name: contactName,
        visitor_email: visitor_email || null,
        contact_id: contact.id,
        conversation_id: conv.id,
        status: 'active',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'visitor_id' }
    )
    .select('id')
    .single();

  return json({
    session_id: session?.id,
    contact_id: contact.id,
    conversation_id: conv.id,
    protocol: conv.protocol,
  });
}

// ─── Send message from visitor ───────────────────────────────────
async function sendMessage(body: any) {
  const { contact_id, client_id, conversation_id, text, type = 'text', visitor_name } = body;

  if (!contact_id || !client_id || !text) {
    return json({ error: 'contact_id, client_id and text are required' }, 400);
  }

  const { data: msg, error } = await supabase
    .from('chat_messages')
    .insert({
      contact_id,
      client_id,
      conversation_id: conversation_id || null,
      text,
      type,
      from_me: false,
      channel_type: 'webchat',
      sender_name: visitor_name || 'Visitante',
      status: 'delivered',
      timestamp: new Date().toISOString(),
    })
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[webchat-api] send error:', error);
    return json({ error: 'Failed to send message' }, 500);
  }

  // Update contact last message
  await supabase
    .from('chat_contacts')
    .update({
      last_message_at: new Date().toISOString(),
      last_message_text: text.slice(0, 100),
      unread_count: 1,
    })
    .eq('id', contact_id);

  return json({ message_id: msg?.id, created_at: msg?.created_at });
}

// ─── Get message history for session ─────────────────────────────
async function getHistory(body: any) {
  const { contact_id, client_id, limit = 50 } = body;

  if (!contact_id || !client_id) {
    return json({ error: 'contact_id and client_id required' }, 400);
  }

  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, text, type, from_me, media_url, caption, sender_name, timestamp, created_at')
    .eq('contact_id', contact_id)
    .eq('client_id', client_id)
    .eq('internal_note', false)
    .order('timestamp', { ascending: true })
    .limit(limit);

  if (error) {
    return json({ error: 'Failed to fetch history' }, 500);
  }

  return json({ messages: data || [] });
}

// ─── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET for config
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const agent = url.searchParams.get('agent');

      if (action === 'config' && agent) {
        return await getConfig(agent);
      }
      return json({ error: 'Invalid GET request' }, 400);
    }

    // POST for actions
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'init':
        return await initSession(body);
      case 'send':
        return await sendMessage(body);
      case 'history':
        return await getHistory(body);
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error('[webchat-api] Error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
