import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeQueueOptions {
  roomName?: string;
  codAgents?: string[];
  onOperatorJoined?: () => void;
  onQueueUpdate?: () => void;
  onRecordingReady?: (recordId: string) => void;
}

export function useRealtimeQueue(options: UseRealtimeQueueOptions) {
  const { roomName, codAgents, onOperatorJoined, onQueueUpdate, onRecordingReady } = options;
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const hasNotifiedOperatorRef = useRef(false);

  // Stable callbacks using refs
  const onOperatorJoinedRef = useRef(onOperatorJoined);
  const onQueueUpdateRef = useRef(onQueueUpdate);
  const onRecordingReadyRef = useRef(onRecordingReady);

  useEffect(() => {
    onOperatorJoinedRef.current = onOperatorJoined;
    onQueueUpdateRef.current = onQueueUpdate;
    onRecordingReadyRef.current = onRecordingReady;
  }, [onOperatorJoined, onQueueUpdate, onRecordingReady]);

  // Reset operator notification flag when roomName changes
  useEffect(() => {
    hasNotifiedOperatorRef.current = false;
  }, [roomName]);

  useEffect(() => {
    // Cleanup previous channels
    channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    channelsRef.current = [];

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Subscription for specific room (lead waiting for operator)
    if (roomName) {
      const roomChannel = supabase
        .channel(`room-${roomName}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'video_call_records',
            filter: `room_name=eq.${roomName}`,
          },
          (payload) => {
            const newRecord = payload.new as Record<string, unknown>;
            const oldRecord = payload.old as Record<string, unknown>;

            // Operator just joined - simplified check (no dependency on oldRecord)
            if (newRecord.operator_joined_at && !hasNotifiedOperatorRef.current) {
              hasNotifiedOperatorRef.current = true;
              onOperatorJoinedRef.current?.();
            }

            // Recording just became ready
            if (newRecord.recording_status === 'ready' && oldRecord.recording_status !== 'ready') {
              onRecordingReadyRef.current?.(newRecord.recording_id as string);
            }
          }
        )
        .subscribe();

      channelsRef.current.push(roomChannel);

      // FALLBACK: Polling every 5s to check if operator joined
      pollInterval = setInterval(async () => {
        if (hasNotifiedOperatorRef.current) {
          if (pollInterval) clearInterval(pollInterval);
          return;
        }
        
        try {
          const { data } = await supabase.functions.invoke('video-room', {
            body: { action: 'join', roomName },
          });
          
          if (data?.room?.operatorJoined && !hasNotifiedOperatorRef.current) {
            hasNotifiedOperatorRef.current = true;
            onOperatorJoinedRef.current?.();
          }
        } catch (e) {
          console.warn('[useRealtimeQueue] Polling error:', e);
        }
      }, 5000);
    }

    // Subscription for video queue (operator watching queue)
    if (codAgents && codAgents.length > 0) {
      const queueChannel = supabase
        .channel('video-queue')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'video_call_records',
          },
          () => {
            onQueueUpdateRef.current?.();
          }
        )
        .subscribe();

      channelsRef.current.push(queueChannel);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      channelsRef.current.forEach(ch => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [roomName, codAgents?.join(',')]);
}

// Hook for lead position in queue with realtime updates
export function useLeadQueuePosition(roomName: string, codAgent: string) {
  const [position, setPosition] = useState(0);
  const [totalInQueue, setTotalInQueue] = useState(0);

  const fetchQueuePosition = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('video-room', {
        body: {
          action: 'queue-status',
          roomName,
          codAgent,
        },
      });

      if (!error && data?.success) {
        setPosition(data.position || 0);
        setTotalInQueue(data.totalInQueue || 0);
      }
    } catch (err) {
      console.error('Error fetching queue position:', err);
    }
  }, [roomName, codAgent]);

  useEffect(() => {
    fetchQueuePosition();
  }, [fetchQueuePosition]);

  // Subscribe to queue updates
  useEffect(() => {
    const channel = supabase
      .channel(`queue-position-${roomName}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_call_records',
        },
        () => {
          fetchQueuePosition();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomName, fetchQueuePosition]);

  return { position, totalInQueue };
}

// Hook for call history with realtime updates
export function useRealtimeHistory(onUpdate: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel('history-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_call_records',
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          const oldRecord = payload.old as Record<string, unknown>;

          // Only trigger update for recording status changes or status changes
          if (
            newRecord.recording_status !== oldRecord.recording_status ||
            newRecord.status !== oldRecord.status
          ) {
            onUpdate();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpdate]);
}
