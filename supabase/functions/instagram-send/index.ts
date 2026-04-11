// ============================================
// Instagram Send Edge Function
// Sends messages via Instagram Graph API
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GRAPH_API = 'https://graph.facebook.com/v22.0';
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, cod_agent, recipient_id, text, media_url, media_type } = await req.json();

    if (!cod_agent || !recipient_id) {
      return json({ error: 'cod_agent and recipient_id are required' }, 400);
    }

    // Get Instagram config
    const { data: config, error: configErr } = await supabase
      .from('instagram_config')
      .select('*')
      .eq('cod_agent', cod_agent)
      .eq('is_active', true)
      .limit(1)
      .single();

    if (configErr || !config?.page_access_token) {
      return json({ error: 'Instagram not configured for this agent' }, 404);
    }

    const pageId = config.instagram_page_id;
    const token = config.page_access_token;

    let messagePayload: any = {
      recipient: { id: recipient_id },
    };

    if (media_url && media_type) {
      // Send media
      messagePayload.message = {
        attachment: {
          type: media_type === 'video' ? 'video' : media_type === 'audio' ? 'audio' : 'image',
          payload: { url: media_url, is_reusable: true },
        },
      };
    } else if (text) {
      // Send text
      messagePayload.message = { text };
    } else {
      return json({ error: 'text or media_url required' }, 400);
    }

    const response = await fetch(`${GRAPH_API}/${pageId}/messages?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[instagram-send] API error:', result);
      return json({ error: 'Instagram API error', details: result }, response.status);
    }

    return json({ success: true, message_id: result.message_id || result.id });
  } catch (err) {
    console.error('[instagram-send] Error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
