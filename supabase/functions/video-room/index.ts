import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DAILY_API_URL = 'https://api.daily.co/v1';

interface CreateRoomRequest {
  action: 'create';
  leadId: number;
  codAgent: string;
  whatsappNumber: string;
  contactName?: string;
}

interface ListRoomsRequest {
  action: 'list';
  codAgent: string;
}

interface CloseRoomRequest {
  action: 'close';
  roomName: string;
}

interface JoinRoomRequest {
  action: 'join';
  roomName: string;
}

type RequestBody = CreateRoomRequest | ListRoomsRequest | CloseRoomRequest | JoinRoomRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
  
  if (!DAILY_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'DAILY_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body: RequestBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { leadId, codAgent, whatsappNumber, contactName } = body as CreateRoomRequest;
        
        // Generate unique room name
        const timestamp = Date.now();
        const roomName = `julia-${codAgent}-${timestamp}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        
        // Create room in Daily.co
        const createResponse = await fetch(`${DAILY_API_URL}/rooms`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: roomName,
            privacy: 'public',
            properties: {
              exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiration
              enable_chat: true,
              enable_screenshare: true,
              enable_knocking: false,
              start_video_off: false,
              start_audio_off: false,
              max_participants: 2,
              lang: 'pt',
              enable_prejoin_ui: true,
              enable_network_ui: true,
              hide_daily_branding: true,
            },
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          console.error('Daily.co error:', errorData);
          throw new Error(`Failed to create room: ${errorData.info || 'Unknown error'}`);
        }

        const roomData = await createResponse.json();
        
        return new Response(
          JSON.stringify({
            success: true,
            room: {
              name: roomData.name,
              url: roomData.url,
              leadId,
              codAgent,
              whatsappNumber,
              contactName,
              createdAt: new Date().toISOString(),
              expiresAt: new Date(roomData.config.exp * 1000).toISOString(),
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'list': {
        // List active rooms from Daily.co
        const listResponse = await fetch(`${DAILY_API_URL}/rooms`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });

        if (!listResponse.ok) {
          throw new Error('Failed to list rooms');
        }

        const roomsData = await listResponse.json();
        
        // Filter rooms that are still active (not expired) and match our naming pattern
        const now = Math.floor(Date.now() / 1000);
        const activeRooms = (roomsData.data || []).filter((room: any) => {
          const isJuliaRoom = room.name.startsWith('julia-');
          const isNotExpired = !room.config?.exp || room.config.exp > now;
          return isJuliaRoom && isNotExpired;
        });

        return new Response(
          JSON.stringify({
            success: true,
            rooms: activeRooms.map((room: any) => ({
              name: room.name,
              url: room.url,
              createdAt: room.created_at,
              expiresAt: room.config?.exp ? new Date(room.config.exp * 1000).toISOString() : null,
            })),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'close': {
        const { roomName } = body as CloseRoomRequest;
        
        // Delete room from Daily.co
        const deleteResponse = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          throw new Error('Failed to close room');
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Room closed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'join': {
        const { roomName } = body as JoinRoomRequest;
        
        // Get room details
        const roomResponse = await fetch(`${DAILY_API_URL}/rooms/${roomName}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${DAILY_API_KEY}`,
          },
        });

        if (!roomResponse.ok) {
          if (roomResponse.status === 404) {
            return new Response(
              JSON.stringify({ error: 'Room not found or expired' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw new Error('Failed to get room');
        }

        const roomData = await roomResponse.json();
        
        return new Response(
          JSON.stringify({
            success: true,
            room: {
              name: roomData.name,
              url: roomData.url,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
