import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  codAgents?: string[];
}

interface CloseRoomRequest {
  action: 'close';
  roomName: string;
}

interface JoinRoomRequest {
  action: 'join';
  roomName: string;
}

interface LeadWaitingRequest {
  action: 'lead-waiting';
  roomName: string;
}

interface OperatorJoinRequest {
  action: 'operator-join';
  roomName: string;
  operatorId?: number;
  operatorName?: string;
}

interface QueueStatusRequest {
  action: 'queue-status';
  roomName: string;
  codAgent: string;
}

interface RecordStartRequest {
  action: 'record-start';
  roomName: string;
  operatorId?: number;
  operatorName?: string;
}

interface RecordEndRequest {
  action: 'record-end';
  roomName: string;
}

interface GetHistoryRequest {
  action: 'history';
  limit?: number;
  operatorId?: number;
  isAdmin?: boolean;
  codAgents?: string[];
}

interface GetRecordingLinkRequest {
  action: 'get-recording-link';
  recordingId: string;
}

type RequestBody = 
  | CreateRoomRequest 
  | ListRoomsRequest 
  | CloseRoomRequest 
  | JoinRoomRequest 
  | LeadWaitingRequest
  | OperatorJoinRequest
  | QueueStatusRequest
  | RecordStartRequest 
  | RecordEndRequest 
  | GetHistoryRequest 
  | GetRecordingLinkRequest;

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
              enable_recording: 'cloud',
              enable_knocking: false,
              start_video_off: false,
              start_audio_off: false,
              max_participants: 4,
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
        const { codAgents } = body as ListRoomsRequest;
        
        // Get rooms from database that have leads waiting (lead_waiting_at set, operator_joined_at null)
        let query = supabase
          .from('video_call_records')
          .select('*')
          .eq('status', 'pending')
          .not('lead_waiting_at', 'is', null)
          .is('operator_joined_at', null);
        
        // Apply multi-tenant filter
        if (codAgents && codAgents.length > 0) {
          query = query.in('cod_agent', codAgents);
        }
        
        const { data: dbRooms, error: dbError } = await query.order('lead_waiting_at', { ascending: true });
        
        if (dbError) {
          console.error('Database error:', dbError);
          throw new Error('Failed to list rooms from database');
        }

        // For each room, get the Daily.co room info
        const roomsWithDetails = await Promise.all(
          (dbRooms || []).map(async (record) => {
            try {
              const roomResponse = await fetch(`${DAILY_API_URL}/rooms/${record.room_name}`, {
                headers: { 'Authorization': `Bearer ${DAILY_API_KEY}` },
              });
              
              if (!roomResponse.ok) {
                return null; // Room expired or deleted
              }
              
              const roomData = await roomResponse.json();
              
              return {
                name: record.room_name,
                url: roomData.url,
                createdAt: record.created_at,
                leadWaitingAt: record.lead_waiting_at,
                expiresAt: roomData.config?.exp ? new Date(roomData.config.exp * 1000).toISOString() : null,
                contactName: record.contact_name,
                whatsappNumber: record.whatsapp_number,
                leadId: record.lead_id,
                codAgent: record.cod_agent,
              };
            } catch {
              return null;
            }
          })
        );

        const activeRooms = roomsWithDetails.filter(Boolean);

        return new Response(
          JSON.stringify({ success: true, rooms: activeRooms }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'lead-waiting': {
        const { roomName } = body as LeadWaitingRequest;
        
        // Register that lead is waiting
        const { error: updateError } = await supabase
          .from('video_call_records')
          .update({ lead_waiting_at: new Date().toISOString() })
          .eq('room_name', roomName);
        
        if (updateError) {
          console.error('Failed to update lead_waiting_at:', updateError);
          throw new Error('Failed to register lead waiting');
        }
        
        // Get queue position
        const { data: room } = await supabase
          .from('video_call_records')
          .select('cod_agent, lead_waiting_at')
          .eq('room_name', roomName)
          .single();
        
        if (!room) {
          return new Response(
            JSON.stringify({ success: false, error: 'Room not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Count rooms ahead in queue (same cod_agent, waiting before this one)
        const { data: queueRooms } = await supabase
          .from('video_call_records')
          .select('room_name, lead_waiting_at')
          .eq('cod_agent', room.cod_agent)
          .eq('status', 'pending')
          .is('operator_joined_at', null)
          .not('lead_waiting_at', 'is', null)
          .order('lead_waiting_at', { ascending: true });
        
        const position = (queueRooms || []).findIndex(r => r.room_name === roomName) + 1;
        const totalInQueue = (queueRooms || []).length;
        
        return new Response(
          JSON.stringify({ success: true, position, totalInQueue }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'queue-status': {
        const { roomName, codAgent } = body as QueueStatusRequest;
        
        // Get queue position for this room
        const { data: queueRooms } = await supabase
          .from('video_call_records')
          .select('room_name, lead_waiting_at')
          .eq('cod_agent', codAgent)
          .eq('status', 'pending')
          .is('operator_joined_at', null)
          .not('lead_waiting_at', 'is', null)
          .order('lead_waiting_at', { ascending: true });
        
        const position = (queueRooms || []).findIndex(r => r.room_name === roomName) + 1;
        const totalInQueue = (queueRooms || []).length;
        
        return new Response(
          JSON.stringify({ success: true, position, totalInQueue }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'operator-join': {
        const { roomName, operatorId, operatorName } = body as OperatorJoinRequest;
        
        // Mark operator as joined - this triggers Realtime event
        const { error: updateError } = await supabase
          .from('video_call_records')
          .update({ 
            operator_joined_at: new Date().toISOString(),
            operator_id: operatorId,
            operator_name: operatorName,
          })
          .eq('room_name', roomName);
        
        if (updateError) {
          console.error('Failed to update operator_joined_at:', updateError);
          throw new Error('Failed to register operator join');
        }
        
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'close': {
        const { roomName } = body as CloseRoomRequest;
        
        // Stop cloud recording and get recording_id
        let recordingId: string | null = null;
        try {
          const stopRecordingResponse = await fetch(
            `${DAILY_API_URL}/rooms/${roomName}/recordings/stop`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
              },
            }
          );
          
          if (stopRecordingResponse.ok) {
            const stopData = await stopRecordingResponse.json();
            recordingId = stopData.id || null;
          }
        } catch (recordingError) {
          console.error('Recording stop error:', recordingError);
        }
        
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
            recording_id: recordingId,
            recording_status: recordingId ? 'processing' : 'none',
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
          JSON.stringify({ success: true, message: 'Room closed', recordingId }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'join': {
        const { roomName } = body as JoinRoomRequest;
        
        // Get room details from Daily.co
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
        
        // Get room record from database for cod_agent info
        const { data: dbRecord } = await supabase
          .from('video_call_records')
          .select('cod_agent, contact_name, operator_joined_at')
          .eq('room_name', roomName)
          .single();
        
        return new Response(
          JSON.stringify({
            success: true,
            room: {
              name: roomData.name,
              url: roomData.url,
              codAgent: dbRecord?.cod_agent,
              contactName: dbRecord?.contact_name,
              operatorJoined: !!dbRecord?.operator_joined_at,
            },
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'record-start': {
        const { roomName, operatorId, operatorName } = body as RecordStartRequest;
        
        // Recording is a secondary feature - failures should NOT block the call
        let recordingStarted = false;
        try {
          const startRecordingResponse = await fetch(
            `${DAILY_API_URL}/rooms/${roomName}/recordings/start`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${DAILY_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'cloud',
                layout: { preset: 'default' },
                maxDuration: 3600,
              }),
            }
          );
          
          if (startRecordingResponse.ok) {
            recordingStarted = true;
            console.log('Recording started successfully for room:', roomName);
          } else {
            const errorText = await startRecordingResponse.text();
            console.warn('Recording start warning (non-blocking):', errorText);
          }
        } catch (recordingError) {
          console.warn('Recording start error (non-blocking):', recordingError);
        }
        
        // Update record with start time, operator info - recording status based on success
        await supabase
          .from('video_call_records')
          .update({ 
            started_at: new Date().toISOString(),
            operator_id: operatorId,
            operator_name: operatorName,
            recording_status: recordingStarted ? 'recording' : 'none',
            status: 'active' 
          })
          .eq('room_name', roomName);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: recordingStarted ? 'Recording started' : 'Call started (recording unavailable)',
            recordingStarted 
          }),
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
        const { limit = 50, operatorId, isAdmin, codAgents } = body as GetHistoryRequest;
        
        let query = supabase
          .from('video_call_records')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        
        // Filter by operator if not admin
        if (!isAdmin && operatorId) {
          query = query.eq('operator_id', operatorId);
        }
        
        // Apply multi-tenant filter
        if (codAgents && codAgents.length > 0) {
          query = query.in('cod_agent', codAgents);
        }
        
        const { data, error } = await query;
        
        if (error) {
          throw new Error(`Failed to fetch history: ${error.message}`);
        }

        return new Response(
          JSON.stringify({ success: true, records: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'get-recording-link': {
        const { recordingId } = body as GetRecordingLinkRequest;
        
        if (!recordingId) {
          return new Response(
            JSON.stringify({ error: 'Recording ID is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const linkResponse = await fetch(
          `${DAILY_API_URL}/recordings/${recordingId}/access-link?valid_for_secs=3600`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${DAILY_API_KEY}`,
            },
          }
        );
        
        if (!linkResponse.ok) {
          const errorText = await linkResponse.text();
          console.error('Failed to get recording link:', errorText);
          return new Response(
            JSON.stringify({ error: 'Recording not ready or not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const linkData = await linkResponse.json();
        
        // Update status to 'ready' and save the URL
        await supabase
          .from('video_call_records')
          .update({ 
            recording_status: 'ready',
            recording_url: linkData.download_link,
          })
          .eq('recording_id', recordingId);
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            downloadLink: linkData.download_link,
            expiresAt: new Date(linkData.expires * 1000).toISOString(),
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
