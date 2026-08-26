import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { DspCampaign, DspCampaignChannel, DspVariant } from '../types';

export function useDspCampaigns(clientId: string | null) {
  return useQuery<DspCampaign[]>({
    queryKey: ['disparos', 'campaigns', clientId],
    enabled: !!clientId,
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_campaigns')
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DspCampaign[];
    },
  });
}

export function useDspCampaignVariants(campaignId: string | null) {
  return useQuery<DspVariant[]>({
    queryKey: ['disparos', 'variants', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_campaign_variants')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at');
      if (error) throw error;
      return (data ?? []) as DspVariant[];
    },
  });
}

export function useDspCampaignChannels(campaignId: string | null) {
  return useQuery<DspCampaignChannel[]>({
    queryKey: ['disparos', 'channels', campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('dsp_campaign_channels')
        .select('*')
        .eq('campaign_id', campaignId);
      if (error) throw error;
      return (data ?? []) as DspCampaignChannel[];
    },
  });
}

export interface SaveCampaignInput {
  id?: string;
  client_id: string;
  name: string;
  goal?: string | null;
  category: string;
  channel_strategy: string;
  audience_filters: any;
  send_window_start: string | null;
  send_window_end: string | null;
  send_week_days: number[];
  scheduled_at: string | null;
  timezone: string;
  schedule_start_at: string | null;
  schedule_end_at: string | null;
  auto_window_control: boolean;
  created_by?: string | null;
  variants: { id?: string; label: string; message_text: string; weight: number; template_id?: string | null }[];
  channels: { queue_id: string; weight: number }[];
}

export function useSaveDspCampaign() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveCampaignInput) => {
      const { variants, channels, ...campaign } = input;

      let campaignId = campaign.id;
      if (campaignId) {
        const { error } = await (supabase as any)
          .from('dsp_campaigns')
          .update({ ...campaign, updated_at: new Date().toISOString() })
          .eq('id', campaignId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from('dsp_campaigns')
          .insert({ ...campaign, status: 'draft' })
          .select('id')
          .single();
        if (error) throw error;
        campaignId = data.id;
      }

      // Variantes: substitui o conjunto (rotação de mensagem)
      await (supabase as any).from('dsp_campaign_variants').delete().eq('campaign_id', campaignId);
      if (variants.length > 0) {
        const { error } = await (supabase as any).from('dsp_campaign_variants').insert(
          variants.map((v) => ({
            campaign_id: campaignId,
            client_id: campaign.client_id,
            label: v.label,
            message_text: v.message_text,
            template_id: v.template_id ?? null,
            weight: v.weight || 1,
            is_active: true,
          })),
        );
        if (error) throw error;
      }

      // Filas selecionadas (rotação de números)
      await (supabase as any).from('dsp_campaign_channels').delete().eq('campaign_id', campaignId);
      if (channels.length > 0) {
        const { error } = await (supabase as any).from('dsp_campaign_channels').insert(
          channels.map((c) => ({
            campaign_id: campaignId,
            client_id: campaign.client_id,
            queue_id: c.queue_id,
            weight: c.weight || 1,
            is_active: true,
          })),
        );
        if (error) throw error;
      }

      return campaignId as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos'] });
      toast.success('Campanha salva');
    },
    onError: (e: any) => toast.error('Erro ao salvar campanha', { description: e?.message }),
  });
}

export function useDeleteDspCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('dsp_campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['disparos'] });
      toast.success('Campanha excluída');
    },
    onError: (e: any) => toast.error('Erro ao excluir', { description: e?.message }),
  });
}

export type CampaignAction =
  | 'start' | 'pause' | 'resume' | 'cancel' | 'schedule'
  | 'submit_approval' | 'approve' | 'reject';

export function useDspCampaignControl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { action: CampaignAction; campaign_id: string; actor?: string; clear_cooldown?: boolean; notes?: string }) => {
      const { data, error } = await supabase.functions.invoke('dsp-campaign-control', { body: vars });
      if (error) {
        const ctx: any = (error as any).context;
        let body: any = null;
        try { body = await ctx?.json?.(); } catch { /* ignore */ }
        const err: any = new Error(body?.error || error.message);
        err.payload = body;
        throw err;
      }
      return data as any;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['disparos'] });
      const map: Record<CampaignAction, string> = {
        start: 'Disparo iniciado',
        pause: 'Campanha pausada',
        resume: 'Campanha retomada',
        cancel: 'Campanha cancelada',
        schedule: 'Campanha agendada',
        submit_approval: 'Enviada para aprovação',
        approve: 'Campanha aprovada',
        reject: 'Campanha reprovada',
      };
      toast.success(map[v.action]);
    },
    onError: (e: any) => {
      if (e?.payload?.error === 'campanha_nao_aprovada') {
        toast.error('Campanha não aprovada', {
          description: 'Envie para aprovação e obtenha o aval antes do disparo real.',
        });
        return;
      }
      if (e?.payload?.error === 'channels_in_cooldown') {
        toast.error('Todas as filas estão em cooldown', {
          description: 'Retome confirmando a liberação das filas.',
        });
        return;
      }
      toast.error('Ação não permitida', { description: e?.message });
    },
  });
}
