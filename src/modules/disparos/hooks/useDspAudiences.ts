import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type {
  DspAudience,
  DspAudienceContact,
  DspAudienceFilterSpec,
  DspAudienceRefreshDiff,
  DspAudienceResolvePreview,
} from '../types';

const KEY = ['disparos', 'audiences'];

export function useDspAudiences(clientId: string | null, includeArchived = false) {
  return useQuery<DspAudience[]>({
    queryKey: [...KEY, clientId, includeArchived],
    enabled: !!clientId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_audiences')
        .select('*')
        .eq('client_id', String(clientId))
        .order('created_at', { ascending: false });
      if (!includeArchived) q = q.eq('status', 'active');
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DspAudience[];
    },
  });
}

export function useDspAudienceContacts(audienceId: string | null, search = '', includeRemoved = false) {
  return useQuery<DspAudienceContact[]>({
    queryKey: ['disparos', 'audience-contacts', audienceId, search, includeRemoved],
    enabled: !!audienceId,
    queryFn: async () => {
      let q = (supabase as any)
        .from('dsp_audience_contacts')
        .select('*')
        .eq('audience_id', String(audienceId))
        .order('created_at', { ascending: false })
        .limit(500);
      if (!includeRemoved) q = q.eq('status', 'active');
      const digits = search.replace(/\D/g, '');
      if (digits.length >= 4) q = q.ilike('phone_e164', `%${digits}%`);
      else if (search.trim().length >= 2) q = q.ilike('name', `%${search.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DspAudienceContact[];
    },
  });
}

/** Quantidade de campanhas que já usaram o público (bloqueia exclusão). */
export function useDspAudienceUsage(audienceId: string | null) {
  return useQuery<number>({
    queryKey: ['disparos', 'audience-usage', audienceId],
    enabled: !!audienceId,
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from('dsp_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('audience_id', String(audienceId));
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export interface NewAudienceContact {
  phone_e164: string;
  name?: string | null;
  first_name?: string | null;
  email?: string | null;
  document?: string | null;
  extra?: Record<string, any> | null;
  contact_id?: string | null;
}

async function insertContacts(
  audienceId: string,
  clientId: string,
  contacts: NewAudienceContact[],
  origin: string,
) {
  for (let i = 0; i < contacts.length; i += 400) {
    const rows = contacts.slice(i, i + 400).map((c) => ({
      audience_id: audienceId,
      client_id: clientId,
      phone_e164: c.phone_e164,
      name: c.name ?? null,
      first_name: c.first_name ?? (c.name ? String(c.name).trim().split(/\s+/)[0] : null),
      email: c.email ?? null,
      document: c.document ?? null,
      extra: c.extra ?? null,
      contact_id: c.contact_id ?? null,
      origin,
      status: 'active',
    }));
    const { error } = await (supabase as any)
      .from('dsp_audience_contacts')
      .upsert(rows, { onConflict: 'audience_id,phone_e164' });
    if (error) throw error;
  }
}

async function recount(audienceId: string) {
  await supabase.functions.invoke('dsp-audience', { body: { action: 'recount', audience_id: audienceId } });
}

export function useCreateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      client_id: string;
      name: string;
      description?: string | null;
      source: 'csv' | 'manual' | 'filter';
      filters?: DspAudienceFilterSpec | null;
      field_map?: Record<string, string> | null;
      created_by?: string | null;
      contacts?: NewAudienceContact[];
    }) => {
      const { data, error } = await (supabase as any)
        .from('dsp_audiences')
        .insert({
          client_id: input.client_id,
          name: input.name.trim(),
          description: input.description ?? null,
          source: input.source,
          filters: input.filters ?? null,
          field_map: input.field_map ?? null,
          status: 'active',
          created_by: input.created_by ?? null,
        })
        .select('*')
        .single();
      if (error) throw error;
      const audience = data as DspAudience;

      if (input.source === 'filter') {
        const { data: res, error: fnErr } = await supabase.functions.invoke('dsp-audience', {
          body: { action: 'materialize', audience_id: audience.id },
        });
        if (fnErr) throw new Error(fnErr.message);
        if ((res as any)?.error) throw new Error((res as any).error);
      } else if (input.contacts?.length) {
        await insertContacts(audience.id, input.client_id, input.contacts, input.source);
        await recount(audience.id);
      }
      return audience;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Público criado');
    },
    onError: (e: any) => toast.error('Erro ao criar público', { description: e?.message }),
  });
}

export function useAddAudienceContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      audience_id: string;
      client_id: string;
      contacts: NewAudienceContact[];
      origin: 'csv' | 'manual';
    }) => {
      if (!input.contacts.length) throw new Error('Nenhum contato válido para incluir');
      await insertContacts(input.audience_id, input.client_id, input.contacts, input.origin);
      await recount(input.audience_id);
      return input.contacts.length;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['disparos', 'audience-contacts'] });
      toast.success(`${n} contato(s) processado(s)`);
    },
    onError: (e: any) => toast.error('Erro ao incluir contatos', { description: e?.message }),
  });
}

export function useRemoveAudienceContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; audience_id: string }) => {
      const { error } = await (supabase as any)
        .from('dsp_audience_contacts')
        .update({ status: 'removed' })
        .eq('id', input.id);
      if (error) throw error;
      await recount(input.audience_id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ['disparos', 'audience-contacts'] });
      toast.success('Contato removido do público');
    },
    onError: (e: any) => toast.error('Erro ao remover', { description: e?.message }),
  });
}

export function useUpdateAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; patch: Partial<DspAudience> }) => {
      const { error } = await (supabase as any).from('dsp_audiences').update(input.patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Público atualizado');
    },
    onError: (e: any) => toast.error('Erro ao atualizar', { description: e?.message }),
  });
}

export function useDeleteAudience() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count, error: cErr } = await (supabase as any)
        .from('dsp_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('audience_id', id);
      if (cErr) throw cErr;
      if ((count ?? 0) > 0) {
        throw new Error('Este público já foi usado em campanha. Arquive em vez de excluir.');
      }
      const { error } = await (supabase as any).from('dsp_audiences').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success('Público excluído');
    },
    onError: (e: any) => toast.error('Não foi possível excluir', { description: e?.message }),
  });
}

/** Prévia (contagem + amostra) dos filtros sem gravar nada. */
export function useResolveAudiencePreview() {
  return useMutation<DspAudienceResolvePreview, any, { client_id: string; filters: DspAudienceFilterSpec }>({
    mutationFn: async (body) => {
      const { data, error } = await supabase.functions.invoke('dsp-audience', {
        body: { action: 'resolve_preview', ...body },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as DspAudienceResolvePreview;
    },
    onError: (e: any) => toast.error('Erro ao validar filtros', { description: e?.message }),
  });
}

/** Compara o público atual com o filtro atualizado; `apply` grava a diferença. */
export function useRefreshAudience() {
  const qc = useQueryClient();
  return useMutation<DspAudienceRefreshDiff, any, { audience_id: string; apply?: boolean }>({
    mutationFn: async (body) => {
      const { data, error } = await supabase.functions.invoke('dsp-audience', {
        body: { action: 'refresh', ...body },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as DspAudienceRefreshDiff;
    },
    onSuccess: (res) => {
      if (res.applied) {
        qc.invalidateQueries({ queryKey: KEY });
        qc.invalidateQueries({ queryKey: ['disparos', 'audience-contacts'] });
        toast.success(`Público atualizado: +${res.added ?? 0} novos, ${res.removed ?? 0} removidos`);
      }
    },
    onError: (e: any) => toast.error('Erro ao atualizar público', { description: e?.message }),
  });
}
