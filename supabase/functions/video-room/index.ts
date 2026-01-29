import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
  operatorName?: string;
}

interface ListRoomsRequest {
  action: 'list';
  codAgent?: string;
}

interface CloseRoomRequest {
  action: 'close';
  roomName: string;
}

interface JoinRoomRequest {
  action: 'join';
  roomName: string;
}

interface RecordStartRequest {
  action: 'record-start';
  roomName: string;
  operatorName?: string;
}

interface RecordEndRequest {
  action: 'record-end';
  roomName: string;
}

interface GetHistoryRequest {
  action: 'history';
  limit?: number;
}

type RequestBody = CreateRoomRequest | ListRoomsRequest | CloseRoomRequest | JoinRoomRequest | RecordStartRequest | RecordEndRequest | GetHistoryRequest;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const DAILY_API_KEY = Deno.env.get('DAILY_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!DAILY_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'DAILY_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

  try {
    const body: RequestBody = await req.json();
    const { action } = body;

    switch (action) {
      case 'create': {
        const { leadId, codAgent, whatsappNumber, contactName, operatorName } = body as CreateRoomRequest;
        
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
              enable_prejoin_ui: false,
              enable_network_ui: true,
            },
          }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          console.error('Daily.co error:', errorData);
          throw new Error(`Failed to create room: ${errorData.info || 'Unknown error'}`);
        }

        const roomData = await createResponse.json();

        // Create pending record in database
        await supabase.from('video_call_records').insert({
          room_name: roomData.name,
          lead_id: leadId,
          cod_agent: codAgent,
          operator_name: operatorName,
          contact_name: contactName,
          whatsapp_number: whatsappNumber,
          status: 'pending',
        });
        
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
        const juliaRooms = (roomsData.data || []).filter((room: any) => {
          const isJuliaRoom = room.name.startsWith('julia-');
          const isNotExpired = !room.config?.exp || room.config.exp > now;
          return isJuliaRoom && isNotExpired;
        });

        // Check each room for active participants
        const roomsWithParticipants = await Promise.all(
          juliaRooms.map(async (room: any) => {
            try {
              const meetingResponse = await fetch(
                `${DAILY_API_URL}/meetings?room=${room.name}&ongoing=true`,
                { headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` } }
              );
              
              if (!meetingResponse.ok) {
                return null;
              }
              
              const meetingData = await meetingResponse.json();
              
              // Room only appears if it has at least one participant
              const hasParticipants = (meetingData.data || []).some(
                (m: any) => m.ongoing && m.max_participants > 0
              );
              
              if (!hasParticipants) {
                return null;
              }

              // Get room metadata from database
              const { data: recordData } = await supabase
                .from('video_call_records')
                .select('contact_name, whatsapp_number, lead_id')
                .eq('room_name', room.name)
                .single();

              return {
                name: room.name,
                url: room.url,
                createdAt: room.created_at,
                expiresAt: room.config?.exp ? new Date(room.config.exp * 1000).toISOString() : null,
                contactName: recordData?.contact_name,
                whatsappNumber: recordData?.whatsapp_number,
                leadId: recordData?.lead_id,
              };
            } catch {
              return null;
            }
          })
        );

        // Filter only rooms with active participants
        const activeRooms = roomsWithParticipants.filter(Boolean);

        return new Response(
          JSON.stringify({ success: true, rooms: activeRooms }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'close': {
        const { roomName } = body as CloseRoomRequest;
        
        // Update record in database
        const endedAt = new Date().toISOString();
        
        // Get the record to calculate duration
        const { data: record } = await supabase
          .from('video_call_records')
          .select('started_at')
          .eq('room_name', roomName)
          .single();
        
        let durationSeconds = null;
        if (record?.started_at) {
          durationSeconds = Math.floor(
            (new Date(endedAt).getTime() - new Date(record.started_at).getTime()) / 1000
          );
        }
        
        await supabase
          .from('video_call_records')
          .update({ 
            ended_at: endedAt, 
            duration_seconds: durationSeconds,
            status: 'completed' 
          })
          .eq('room_name', roomName);
        
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

      case 'record-start': {
        const { roomName, operatorName } = body as RecordStartRequest;
        
        // Update record with start time
        await supabase
          .from('video_call_records')
          .update({ 
            started_at: new Date().toISOString(),
            operator_name: operatorName,
            status: 'active' 
          })
          .eq('room_name', roomName);

        return new Response(
          JSON.stringify({ success: true, message: 'Recording started' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'record-end': {
        const { roomName } = body as RecordEndRequest;
        
        const endedAt = new Date().toISOString();
        
        // Get the record to calculate duration
        const { data: record } = await supabase
          .from('video_call_records')
          .select('started_at')
          .eq('room_name', roomName)
          .single();
        
        let durationSeconds = null;
        if (record?.started_at) {
          durationSeconds = Math.floor(
            (new Date(endedAt).getTime() - new Date(record.started_at).getTime()) / 1000
          );
        }
        
        await supabase
          .from('video_call_records')
          .update({ 
            ended_at: endedAt, 
            duration_seconds: durationSeconds,
            status: 'completed' 
          })
          .eq('room_name', roomName);

        return new Response(
          JSON.stringify({ success: true, message: 'Recording ended', durationSeconds }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'history': {
        const { limit = 50 } = body as GetHistoryRequest;
        
        const { data, error } = await supabase
          .from('video_call_records')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        if (error) {
          throw new Error(`Failed to fetch history: ${error.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, records: data }),
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
