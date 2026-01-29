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
