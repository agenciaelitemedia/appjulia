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

export function useVideoRooms(enabled = true) {
  return useQuery({
    queryKey: ['video-rooms'],
    queryFn: async (): Promise<VideoRoom[]> => {
      const { data, error } = await supabase.functions.invoke<ListRoomsResponse>('video-room', {
        body: {
          action: 'list',
        },
      });

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'Failed to list rooms');
      }

      return data.rooms || [];
    },
    enabled,
    refetchInterval: 10000, // Refresh every 10 seconds
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

export function useJoinVideoRoom() {
  return useMutation({
    mutationFn: async (roomName: string): Promise<VideoRoom> => {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; room: VideoRoom }>('video-room', {
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
