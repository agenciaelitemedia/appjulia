import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DeviceQueueLink {
  device_id: string;
  queue_id: string;
  client_id: number;
}

/** Filas vinculadas a um único dispositivo. */
export function useDeviceQueueIds(deviceId: string | null | undefined) {
  return useQuery<string[]>({
    queryKey: ['wavoip-device-queues', deviceId],
    enabled: !!deviceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_device_queues')
        .select('queue_id')
        .eq('device_id', deviceId);
      if (error) throw error;
      return (data ?? []).map((r: any) => String(r.queue_id));
    },
  });
}

/** Todos os vínculos do client: mapa queueId -> deviceId[]. */
export function useClientDeviceQueueLinks(clientId: number | string | null | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    if (clientId == null) return;
    const channel = supabase
      .channel(`wavoip-device-queues-${clientId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wavoip_device_queues', filter: `client_id=eq.${clientId}` },
        (payload) => {
          qc.invalidateQueries({ queryKey: ['wavoip-device-queues-by-client', clientId] });
          const row: any = (payload.new as any) ?? (payload.old as any);
          if (row?.device_id) {
            qc.invalidateQueries({ queryKey: ['wavoip-device-queues', String(row.device_id)] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, qc]);

  return useQuery<Record<string, string[]>>({
    queryKey: ['wavoip-device-queues-by-client', clientId],
    enabled: clientId != null,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_device_queues')
        .select('device_id, queue_id')
        .eq('client_id', clientId);
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const r of (data ?? []) as any[]) {
        const qid = String(r.queue_id);
        (map[qid] ||= []).push(String(r.device_id));
      }
      return map;
    },
    staleTime: 60_000,
  });
}

/** Substitui o conjunto de filas vinculadas ao dispositivo por `queueIds`. */
export function useSetDeviceQueues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { deviceId: string; clientId: number; queueIds: string[]; createdBy?: number | null }) => {
      const { deviceId, clientId, queueIds, createdBy } = params;
      const { data: existing, error: eErr } = await (supabase as any)
        .from('wavoip_device_queues')
        .select('queue_id')
        .eq('device_id', deviceId);
      if (eErr) throw eErr;
      const current = new Set<string>((existing ?? []).map((r: any) => String(r.queue_id)));
      const next = new Set<string>(queueIds);
      const toAdd = [...next].filter((q) => !current.has(q));
      const toRemove = [...current].filter((q) => !next.has(q));

      if (toRemove.length > 0) {
        const { error } = await (supabase as any)
          .from('wavoip_device_queues')
          .delete()
          .eq('device_id', deviceId)
          .in('queue_id', toRemove);
        if (error) throw error;
      }
      if (toAdd.length > 0) {
        const rows = toAdd.map((qid) => ({
          device_id: deviceId,
          queue_id: qid,
          client_id: clientId,
          created_by: createdBy ?? null,
        }));
        const { error } = await (supabase as any)
          .from('wavoip_device_queues')
          .insert(rows);
        if (error) throw error;
      }
      return { added: toAdd.length, removed: toRemove.length };
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['wavoip-device-queues', vars.deviceId] });
      qc.invalidateQueries({ queryKey: ['wavoip-device-queues-by-client', vars.clientId] });
      toast.success('Filas vinculadas atualizadas');
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Falha ao salvar filas vinculadas');
    },
  });
}

/** Lista filas ativas do client, para uso nos seletores. */
export function useClientQueuesForLink(clientId: number | string | null | undefined) {
  return useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['queues-for-link', clientId],
    enabled: clientId != null,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('queues')
        .select('id, name, is_active, is_deleted')
        .eq('client_id', String(clientId))
        .eq('is_active', true)
        .neq('is_deleted', true)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: String(r.id), name: r.name as string }));
    },
    staleTime: 60_000,
  });
}