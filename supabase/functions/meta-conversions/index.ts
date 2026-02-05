import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createHash } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_GRAPH_API = 'https://graph.facebook.com/v21.0';

interface UserData {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  externalId?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  fbp?: string;
  fbc?: string;
}

interface CustomData {
  value?: number;
  currency?: string;
  contentName?: string;
  contentCategory?: string;
  contentIds?: string[];
  contentType?: string;
  orderId?: string;
  predictedLtv?: number;
  numItems?: number;
  searchString?: string;
  status?: string;
  leadSource?: string;
  campaignId?: string;
}

interface ConversionEvent {
  eventName: string;
  eventTime?: number;
  eventSourceUrl?: string;
  actionSource: 'website' | 'app' | 'phone_call' | 'chat' | 'email' | 'other' | 'system_generated';
  userData: UserData;
  customData?: CustomData;
  eventId?: string;
}

interface RequestBody {
  action: string;
  accessToken: string;
  pixelId: string;
  testEventCode?: string;
  events: ConversionEvent[];
}

// Hash function for PII data
async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Format phone number for Meta (remove non-digits, add country code if needed)
function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  // If doesn't start with country code (assuming Brazil), add 55
  if (digits.length <= 11) {
    return '55' + digits;
  }
  return digits;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, pixelId, testEventCode, events } = await req.json() as RequestBody;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pixelId) {
      return new Response(
        JSON.stringify({ error: 'Pixel ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action !== 'send_events') {
      return new Response(
        JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one event is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process and hash user data for each event
    const processedEvents = await Promise.all(events.map(async (event) => {
      const hashedUserData: Record<string, string | string[]> = {};
      
      // Hash PII fields
      if (event.userData.email) {
        hashedUserData.em = [await hashData(event.userData.email)];
      }
      if (event.userData.phone) {
        hashedUserData.ph = [await hashData(formatPhone(event.userData.phone))];
      }
      if (event.userData.firstName) {
        hashedUserData.fn = [await hashData(event.userData.firstName)];
      }
      if (event.userData.lastName) {
        hashedUserData.ln = [await hashData(event.userData.lastName)];
      }
      if (event.userData.city) {
        hashedUserData.ct = [await hashData(event.userData.city)];
      }
      if (event.userData.state) {
        hashedUserData.st = [await hashData(event.userData.state)];
      }
      if (event.userData.country) {
        hashedUserData.country = [await hashData(event.userData.country)];
      }
      if (event.userData.zipCode) {
        hashedUserData.zp = [await hashData(event.userData.zipCode)];
      }
      if (event.userData.externalId) {
        hashedUserData.external_id = [await hashData(event.userData.externalId)];
      }
      
      // Non-hashed fields
      if (event.userData.clientIpAddress) {
        hashedUserData.client_ip_address = event.userData.clientIpAddress;
      }
      if (event.userData.clientUserAgent) {
        hashedUserData.client_user_agent = event.userData.clientUserAgent;
      }
      if (event.userData.fbp) {
        hashedUserData.fbp = event.userData.fbp;
      }
      if (event.userData.fbc) {
        hashedUserData.fbc = event.userData.fbc;
      }

      // Build custom data
      const customData: Record<string, unknown> = {};
      if (event.customData) {
        if (event.customData.value !== undefined) customData.value = event.customData.value;
        if (event.customData.currency) customData.currency = event.customData.currency;
        if (event.customData.contentName) customData.content_name = event.customData.contentName;
        if (event.customData.contentCategory) customData.content_category = event.customData.contentCategory;
        if (event.customData.contentIds) customData.content_ids = event.customData.contentIds;
        if (event.customData.contentType) customData.content_type = event.customData.contentType;
        if (event.customData.orderId) customData.order_id = event.customData.orderId;
        if (event.customData.predictedLtv) customData.predicted_ltv = event.customData.predictedLtv;
        if (event.customData.numItems) customData.num_items = event.customData.numItems;
        if (event.customData.searchString) customData.search_string = event.customData.searchString;
        if (event.customData.status) customData.status = event.customData.status;
        if (event.customData.leadSource) customData.lead_source = event.customData.leadSource;
        if (event.customData.campaignId) customData.campaign_id = event.customData.campaignId;
      }

      return {
        event_name: event.eventName,
        event_time: event.eventTime || Math.floor(Date.now() / 1000),
        event_source_url: event.eventSourceUrl,
        action_source: event.actionSource,
        event_id: event.eventId || crypto.randomUUID(),
        user_data: hashedUserData,
        custom_data: Object.keys(customData).length > 0 ? customData : undefined,
      };
    }));

    // Send to Meta Conversions API
    const url = new URL(`${META_GRAPH_API}/${pixelId}/events`);
    url.searchParams.set('access_token', accessToken);

    const body: Record<string, unknown> = {
      data: processedEvents,
    };

    // Add test event code if provided (for debugging)
    if (testEventCode) {
      body.test_event_code = testEventCode;
    }

    console.log('Sending events to Meta:', JSON.stringify(body, null, 2));

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    // Check for Meta API errors
    if (result.error) {
      console.error('Meta Conversions API Error:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message || 'Meta API error', details: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Meta Conversions API Response:', result);

    return new Response(
      JSON.stringify({
        success: true,
        eventsReceived: result.events_received,
        messages: result.messages,
        fbTraceId: result.fbtrace_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-conversions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
