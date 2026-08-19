import { useQuery } from '@tanstack/react-query';
import { externalDb, supabase } from '../extend/db';
import { getMessagePreview } from '@/lib/chat/messagePreview';
import { getBrPhoneVariants } from '@/lib/phoneVariants';

export interface NoResponsePreviewItem {
  conversationId: string;
  leadName: string;
  leadPhone: string;
  lastCustomerMessageAt: string;
  dueAt: string;
  eligible: boolean;
  lastMessagePreview: string;
  lastMessageFromMe: boolean;
  lastMessageAt: string | null;
  crmStage: string;
}

export type NoResponseScope = 'agent' | 'office' | 'none';

export interface NoResponsePreviewResult {
  items: NoResponsePreviewItem[];
  scope: NoResponseScope;
}

const WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Prévia do gatilho "Cliente parou de responder" — usa exatamente os mesmos
 * filtros do alert-notifications-cron para mostrar quando cada lead vence.
 */
export function useNoResponsePreview(codAgent: string | null, minutes: number) {
  const safeMinutes = Math.max(1, Number(minutes) || 30);

  return useQuery({
    queryKey: ['alerts', 'no-response-preview', codAgent, safeMinutes],
    enabled: !!codAgent,
    staleTime: 30_000,
    queryFn: async (): Promise<NoResponsePreviewResult> => {
      const now = Date.now();
      const floor = new Date(now - WINDOW_MS).toISOString();

      const agentRows = await externalDb.raw<{ client_id: string }>({
        query: 'SELECT client_id::text AS client_id FROM agents WHERE cod_agent::text = $1 LIMIT 1',
        params: [String(codAgent)],
      });
      const clientId = agentRows?.[0]?.client_id;
      if (!clientId) return { items: [], scope: 'none' };

      const { data: convs, error } = await (supabase as any)
        .from('chat_conversations')
        .select('id, contact_id, last_customer_message_at, last_message_from_me, status')
        .eq('client_id', String(clientId))
        .eq('last_message_from_me', true)
        .in('status', ['pending', 'open'])
        .order('updated_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = (convs ?? []) as any[];
      if (rows.length === 0) return { items: [], scope: 'office' };

      const contactIds = [...new Set(rows.map((row) => row.contact_id).filter(Boolean))];
      const { data: contacts, error: contactsError } = await (supabase as any)
        .from('chat_contacts')
        .select('id, phone, name')
        .in('id', contactIds);
      if (contactsError) throw contactsError;
      const byId = new Map(((contacts ?? []) as any[]).map((contact: any) => [contact.id, contact]));

      // Última mensagem (não interna) de cada conversa — chat_conversations não
      // guarda o texto da última mensagem.
      const convIds = rows.map((r) => r.id);
      const { data: msgs } = await (supabase as any)
        .from('chat_messages')
        .select('conversation_id, text, caption, file_name, type, from_me, timestamp, internal_note')
        .in('conversation_id', convIds)
        .order('timestamp', { ascending: false })
        .limit(Math.max(convIds.length * 20, 500));

      const lastMsg = new Map<string, any>();
      for (const m of (msgs ?? []) as any[]) {
        if (m.internal_note) continue;
        if (!lastMsg.has(m.conversation_id)) lastMsg.set(m.conversation_id, m);
      }

      // Etapa no CRM da Julia.
      // 1) CRM clássico (banco legado): crm_atendimento_cards + stages.
      const phonesForStage = [
        ...new Set(
          rows
            .map((r) => String((byId.get(r.contact_id) as any)?.phone ?? ''))
            .flatMap((p) => getBrPhoneVariants(p)),
        ),
      ];
      const stageByPhone = new Map<string, string>();
      if (phonesForStage.length) {
        try {
          const legacy = await externalDb.raw<{ whatsapp_number: string; stage_name: string | null; updated_at: string | null }>({
            query: `
              SELECT c.whatsapp_number::text AS whatsapp_number,
                     s.name AS stage_name,
                     COALESCE(c.updated_at, c.created_at) AS updated_at
                FROM crm_atendimento_cards c
                LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
               WHERE c.whatsapp_number::text = ANY($1::varchar[])
               ORDER BY COALESCE(c.updated_at, c.created_at) DESC NULLS LAST
            `,
            params: [phonesForStage],
          });
          for (const r of legacy ?? []) {
            const name = String(r.stage_name ?? '').trim();
            if (!name) continue;
            for (const v of getBrPhoneVariants(String(r.whatsapp_number))) {
              const tail = v.slice(-8);
              if (tail && !stageByPhone.has(tail)) stageByPhone.set(tail, name);
            }
          }
        } catch {
          // silencioso: cai no fallback X-Julia
        }
      }

      // 2) Fallback X-Julia (xj_deals -> xj_pipelines) por contato.
      const { data: deals } = await (supabase as any)
        .from('xj_deals')
        .select('contact_id, contact_phone, pipeline_id, updated_at')
        .eq('client_id', String(clientId))
        .order('updated_at', { ascending: false })
        .limit(1000);
      const pipelineIds = [...new Set(((deals ?? []) as any[]).map((d) => d.pipeline_id).filter(Boolean))];
      const { data: stages } = pipelineIds.length
        ? await (supabase as any).from('xj_pipelines').select('id, name').in('id', pipelineIds)
        : { data: [] };
      const stageName = new Map(((stages ?? []) as any[]).map((s: any) => [s.id, s.name]));
      for (const d of (deals ?? []) as any[]) {
        const tail = String(d.contact_phone ?? '').replace(/\D/g, '').slice(-8);
        if (!tail || stageByPhone.has(tail)) continue;
        stageByPhone.set(tail, String(stageName.get(d.pipeline_id) ?? ''));
      }

      const out: NoResponsePreviewItem[] = [];
      const seen = new Set<string>();
      for (const conv of rows) {
        const contact = byId.get(conv.contact_id) as any;
        const phone = String(contact?.phone ?? '').replace(/\D/g, '');
        if (!phone || seen.has(phone)) continue;
        const m = lastMsg.get(conv.id);
        const lastMessageMs = m?.timestamp ? new Date(m.timestamp).getTime() : Number.NaN;
        if (!m?.from_me || !Number.isFinite(lastMessageMs)) continue;
        if (lastMessageMs < now - WINDOW_MS) continue;
        const dueMs = lastMessageMs + safeMinutes * 60_000;
        if (dueMs > now) continue;
        seen.add(phone);

        out.push({
          conversationId: conv.id,
          leadName: String(contact?.name ?? '') || 'Sem nome',
          leadPhone: phone,
          lastCustomerMessageAt: conv.last_customer_message_at ?? m.timestamp,
          dueAt: new Date(dueMs).toISOString(),
          eligible: dueMs <= now,
          lastMessagePreview: m
            ? getMessagePreview({ type: m.type, text: m.text, caption: m.caption, file_name: m.file_name })
            : '—',
          lastMessageFromMe: !!m?.from_me,
          lastMessageAt: m?.timestamp ?? null,
          crmStage: stageByPhone.get(phone.slice(-8)) ?? '',
        });
      }

      out.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
      return { items: out, scope: 'office' };
    },
  });
}
