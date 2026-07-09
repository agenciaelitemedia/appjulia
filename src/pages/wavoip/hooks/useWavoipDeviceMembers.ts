import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface WavoipDeviceMember {
  id: string;
  device_id: string;
  app_user_id: number;
  granted_by: number | null;
  created_at: string;
}

export function useWavoipDeviceMembers(deviceId: string | null | undefined) {
  return useQuery<WavoipDeviceMember[]>({
    queryKey: ['wavoip-device-members', deviceId],
    enabled: !!deviceId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_device_members')
        .select('*')
        .eq('device_id', deviceId);
      if (error) throw error;
      return (data ?? []) as WavoipDeviceMember[];
    },
  });
}

/** Retorna os device_ids compartilhados com o usuário logado. */
export function useMySharedWavoipDeviceIds() {
  const { user } = useAuth();
  const appUserId = user?.id ? Number(user.id) : null;
  return useQuery<string[]>({
    queryKey: ['wavoip-shared-device-ids', appUserId],
    enabled: !!appUserId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_device_members')
        .select('device_id')
        .eq('app_user_id', appUserId);
      if (error) throw error;
      return ((data ?? []) as { device_id: string }[]).map((r) => r.device_id);
    },
  });
}

export function useToggleWavoipDeviceMember(deviceId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const granterId = user?.id ? Number(user.id) : null;

  return useMutation({
    mutationFn: async ({ userId, grant }: { userId: number; grant: boolean }) => {
      if (grant) {
        const { error } = await (supabase as any)
          .from('wavoip_device_members')
          .insert({ device_id: deviceId, app_user_id: userId, granted_by: granterId });
        if (error && !String(error.message).includes('duplicate')) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('wavoip_device_members')
          .delete()
          .eq('device_id', deviceId)
          .eq('app_user_id', userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wavoip-device-members', deviceId] });
      qc.invalidateQueries({ queryKey: ['wavoip-shared-device-ids'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Erro ao atualizar acesso'),
  });
}