export interface VideoRoom {
  name: string;
  url: string;
  leadId?: number;
  codAgent?: string;
  whatsappNumber?: string;
  contactName?: string;
  createdAt: string;
  expiresAt?: string | null;
  status?: 'waiting' | 'in_call' | 'ended';
}

export interface CreateRoomResponse {
  success: boolean;
  room: VideoRoom;
  error?: string;
}

export interface ListRoomsResponse {
  success: boolean;
  rooms: VideoRoom[];
  error?: string;
}

export interface VideoQueueItem {
  roomName: string;
  roomUrl: string;
  whatsappNumber: string;
  contactName?: string;
  codAgent: string;
  createdAt: string;
  waitTime: number; // in seconds
}

export interface CallHistoryRecord {
  id: string;
  room_name: string;
  lead_id: number | null;
  cod_agent: string;
  operator_id: number | null;
  operator_name: string | null;
  contact_name: string | null;
  whatsapp_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  status: string;
  created_at: string;
  recording_id: string | null;
  recording_status: string | null;
}
