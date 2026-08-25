import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export interface ContactVoipCall {
  id: number;
  direction: string | null;
  caller: string | null;
  called: string | null;
  extension_number: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  hangup_cause: string | null;
  record_url: string | null;
  created_at: string;
}

export interface ContactZapCall {
  id: string;
  app_user_id: number | null;
  direction: string | null;
  status: string | null;
  from_number: string | null;
  to_number: string | null;
  whatsapp_call_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  end_reason: string | null;
  recording_url: string | null;
  recording_status: string;
  created_at: string;
}

function variantList(phone: string | null | undefined) {
  return getBrPhoneVariants(phone);
}

/**
 * Monta o filtro de vínculo: prioriza `contact_id` (gravado na origem da ligação)
 * e cai no telefone canônico (`contact_phone_e164`) como rede de segurança.
 */
function linkFilter(contactId: string | null | undefined, variants: string[]) {
  const parts: string[] = [];
  if (contactId) parts.push(`contact_id.eq.${contactId}`);
  if (variants.length) parts.push(`contact_phone_e164.in.(${variants.join(',')})`);
  return parts.join(',');
}

/** Histórico de ligações VoIP (SIP / phone_call_logs) para um contato. */
export function useContactVoipCalls(
  clientId: number | null,
  phone: string | null,
  contactId?: string | null,
) {
  const variants = variantList(phone);
  const filter = linkFilter(contactId, variants);
  return useQuery({
    queryKey: ['contact-voip-calls', clientId, contactId ?? null, variants.join(',')],
    enabled: !!clientId && !!filter,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_call_logs')
        .select('id, direction, caller, called, extension_number, started_at, ended_at, duration_seconds, hangup_cause, record_url, created_at')
        .eq('client_id', clientId!)
        .or(filter)
        .order('started_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as ContactVoipCall[];
    },
  });
}

/** Histórico de ligações ZAP Call (Wavoip / wavoip_call_logs) para um contato. */
export function useContactZapCalls(
  clientId: number | null,
  phone: string | null,
  contactId?: string | null,
) {
  const variants = variantList(phone);
  const filter = linkFilter(contactId, variants);
  return useQuery({
    queryKey: ['contact-zap-calls', clientId, contactId ?? null, variants.join(',')],
    enabled: !!clientId && !!filter,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('wavoip_call_logs')
        .select('id, app_user_id, direction, status, from_number, to_number, whatsapp_call_id, started_at, ended_at, duration_seconds, end_reason, recording_url, recording_status, created_at')
        .eq('client_id', clientId!)
        .or(filter)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ContactZapCall[];
    },
  });
}

/** Mapa ramal -> id do membro atribuído, para exibir "quem fez" nas ligações VoIP. */
export function useExtensionOwners(clientId: number | null) {
  return useQuery({
    queryKey: ['contact-extension-owners', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('extension_number, assigned_member_id')
        .eq('client_id', clientId!);
      if (error) throw error;
      const map: Record<string, number | null> = {};
      for (const e of (data || []) as any[]) map[String(e.extension_number)] = e.assigned_member_id ?? null;
      return map;
    },
  });
}
