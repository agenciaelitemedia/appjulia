import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CreateRoomResponse, ListRoomsResponse, VideoRoom } from '../types';

interface CreateRoomParams {
  leadId: number;
  codAgent: string;
  whatsappNumber: string;
  contactName?: string;
}

interface OperatorJoinParams {
  roomName: string;
  operatorId?: number;
  operatorName?: string;
}

export function useCreateVideoRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateRoomParams): Promise<VideoRoom> => {
      const { data, error } = await supabase.functions.invoke<CreateRoomResponse>('video-room', {
        body: {
          action: 'create',
          ...params,
        },
      });

      if (error) throw error;
      if (!data?.success || !data.room) {
        throw new Error(data?.error || 'Failed to create room');
      }

      return data.room;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-rooms'] });
    },
    onError: (error) => {
      console.error('Error creating video room:', error);
      toast.error('Erro ao criar sala de vídeo');
    },
  });
}

export function useVideoRooms(codAgents: string[] = [], enabled = true) {
  return useQuery({
    queryKey: ['video-rooms', codAgents],
    queryFn: async (): Promise<VideoRoom[]> => {
      const { data, error } = await supabase.functions.invoke<ListRoomsResponse>('video-room', {
        body: {
          action: 'list',
          codAgents,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to list rooms');
      }

      return data.rooms || [];
    },
    enabled: enabled && codAgents.length > 0,
    refetchInterval: 30000, // Fallback polling every 30s (realtime handles most updates)
  });
}

export function useCloseVideoRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (roomName: string): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('video-room', {
        body: {
          action: 'close',
          roomName,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to close room');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-rooms'] });
      toast.success('Sala encerrada com sucesso');
    },
    onError: (error) => {
      console.error('Error closing video room:', error);
      toast.error('Erro ao encerrar sala');
    },
  });
}

export function useOperatorJoinRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: OperatorJoinParams): Promise<void> => {
      const { data, error } = await supabase.functions.invoke('video-room', {
        body: {
          action: 'operator-join',
          ...params,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to register operator join');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-rooms'] });
    },
    onError: (error) => {
      console.error('Error registering operator join:', error);
    },
  });
}

export function useJoinVideoRoom() {
  return useMutation({
    mutationFn: async (roomName: string): Promise<VideoRoom & { operatorJoined?: boolean }> => {
      const { data, error } = await supabase.functions.invoke<{ 
        success: boolean; 
        room: VideoRoom & { operatorJoined?: boolean };
      }>('video-room', {
        body: {
          action: 'join',
          roomName,
        },
      });

      if (error) throw error;
      if (!data?.success || !data.room) {
        throw new Error('Room not found or expired');
      }

      return data.room;
    },
  });
}
