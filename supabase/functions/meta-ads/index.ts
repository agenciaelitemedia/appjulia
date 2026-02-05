import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const META_GRAPH_API = 'https://graph.facebook.com/v21.0';

interface RequestBody {
  action: string;
  accessToken: string;
  adAccountId?: string;
  campaignId?: string;
  datePreset?: string;
  fields?: string[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, accessToken, adAccountId, campaignId, datePreset, fields } = await req.json() as RequestBody;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: 'Access token is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    switch (action) {
      case 'get_ad_accounts': {
        // Get ad accounts accessible by the user
        const url = new URL(`${META_GRAPH_API}/me/adaccounts`);
        url.searchParams.set('fields', 'id,name,account_id,account_status,currency,timezone_name,business_name');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      case 'get_campaigns': {
        if (!adAccountId) {
          throw new Error('Ad Account ID is required for get_campaigns');
        }
        
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const url = new URL(`${META_GRAPH_API}/${accountId}/campaigns`);
        url.searchParams.set('fields', 'id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time');
        url.searchParams.set('limit', '100');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      case 'get_adsets': {
        if (!adAccountId) {
          throw new Error('Ad Account ID is required for get_adsets');
        }
        
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const url = new URL(`${META_GRAPH_API}/${accountId}/adsets`);
        url.searchParams.set('fields', 'id,name,status,campaign_id,daily_budget,lifetime_budget,targeting,optimization_goal');
        url.searchParams.set('limit', '100');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      case 'get_ads': {
        if (!adAccountId) {
          throw new Error('Ad Account ID is required for get_ads');
        }
        
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const url = new URL(`${META_GRAPH_API}/${accountId}/ads`);
        url.searchParams.set('fields', 'id,name,status,campaign_id,adset_id,creative{id,name,thumbnail_url,object_story_spec}');
        url.searchParams.set('limit', '100');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      case 'get_campaign_insights': {
        if (!campaignId) {
          throw new Error('Campaign ID is required for get_campaign_insights');
        }
        
        const url = new URL(`${META_GRAPH_API}/${campaignId}/insights`);
        url.searchParams.set('fields', 'impressions,clicks,ctr,cpm,cpc,spend,reach,frequency,actions,cost_per_action_type');
        url.searchParams.set('date_preset', datePreset || 'last_30d');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      case 'get_account_insights': {
        if (!adAccountId) {
          throw new Error('Ad Account ID is required for get_account_insights');
        }
        
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const url = new URL(`${META_GRAPH_API}/${accountId}/insights`);
        url.searchParams.set('fields', 'impressions,clicks,ctr,cpm,cpc,spend,reach,frequency,actions,cost_per_action_type');
        url.searchParams.set('date_preset', datePreset || 'last_30d');
        url.searchParams.set('level', 'account');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      case 'get_pixels': {
        if (!adAccountId) {
          throw new Error('Ad Account ID is required for get_pixels');
        }
        
        const accountId = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
        const url = new URL(`${META_GRAPH_API}/${accountId}/adspixels`);
        url.searchParams.set('fields', 'id,name,code,creation_time,last_fired_time');
        url.searchParams.set('access_token', accessToken);
        
        const response = await fetch(url.toString());
        result = await response.json();
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    // Check for Meta API errors
    if (result.error) {
      console.error('Meta API Error:', result.error);
      return new Response(
        JSON.stringify({ error: result.error.message || 'Meta API error', details: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in meta-ads:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
