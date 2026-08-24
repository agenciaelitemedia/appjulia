import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { normalizeBrPhone, brPhoneVariants } from '@/lib/phoneNormalize';
import type { ImportRow } from '../lib/csvImport';

const BATCH_SIZE = 100;

export interface ImportProgress {
  /** Linhas gravadas até agora. */
  done: number;
  total: number;
}

export interface ImportSummary {
  created: number;
  skipped: number;
  failed: number;
  linkedToChat: number;
  errors: string[];
}

interface UseImportDealsCsvOptions {
  boardId: string | null;
  clientId: string;
  codAgent: string;
  userName?: string;
}

interface RunOptions {
  pipelineId: string;
  rows: ImportRow[];
  /** Maior `position` já usada na etapa de destino. */
  startPosition: number;
  skippedCount: number;
}

/**
 * Cria cards em lote no CRM Builder a partir das linhas validadas do CSV.
 * Reaproveita o mesmo payload da criação individual (`useCRMDeals.createDeal`)
 * e vincula ao chat quando o telefone já existir em `chat_contacts`.
 */
export function useImportDealsCsv({ boardId, clientId, codAgent, userName }: UseImportDealsCsvOptions) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<ImportProgress>({ done: 0, total: 0 });

  /** Resolve contato do chat + conversa mais recente por telefone (consulta única). */
  const resolveChatLinks = useCallback(
    async (phones: string[]) => {
      const links = new Map<string, { contactId: string; contactName: string | null; conversationId: string | null }>();
      if (!clientId || phones.length === 0) return links;

      const variants = Array.from(
        new Set(phones.flatMap((p) => [normalizeBrPhone(p), ...brPhoneVariants(p)]).filter(Boolean)),
      );
      if (variants.length === 0) return links;

      const { data: contacts } = await supabase
        .from('chat_contacts')
        .select('id, name, phone')
        .eq('client_id', clientId)
        .in('phone', variants);

      const rows = contacts || [];
      if (rows.length === 0) return links;

      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id, contact_id, updated_at')
        .eq('client_id', clientId)
        .in('contact_id', rows.map((c) => c.id))
        .in('status', ['pending', 'open', 'closed'])
        .order('updated_at', { ascending: false });

      const convByContact = new Map<string, string>();
      (convs || []).forEach((c) => {
        if (c.contact_id && !convByContact.has(c.contact_id)) convByContact.set(c.contact_id, c.id);
      });

      rows.forEach((c) => {
        const entry = {
          contactId: c.id,
          contactName: c.name ?? null,
          conversationId: convByContact.get(c.id) ?? null,
        };
        // Indexa por todas as variantes para casar com o telefone do CSV.
        [normalizeBrPhone(c.phone), ...brPhoneVariants(c.phone)].forEach((v) => {
          if (v) links.set(v, entry);
        });
      });

      return links;
    },
    [clientId],
  );

  const run = useCallback(
    async ({ pipelineId, rows, startPosition, skippedCount }: RunOptions): Promise<ImportSummary> => {
      const summary: ImportSummary = {
        created: 0,
        skipped: skippedCount,
        failed: 0,
        linkedToChat: 0,
        errors: [],
      };
      if (!boardId || !clientId || rows.length === 0) return summary;

      setIsRunning(true);
      setProgress({ done: 0, total: rows.length });

      try {
        const chatLinks = await resolveChatLinks(
          rows.map((r) => r.data.contact_phone || '').filter(Boolean),
        );

        for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
          const chunk = rows.slice(offset, offset + BATCH_SIZE);

          const payload = chunk.map((row, i) => {
            const custom: Record<string, unknown> = { ...row.data.custom_fields };
            const phone = row.data.contact_phone || '';
            const link = phone ? chatLinks.get(normalizeBrPhone(phone)) : undefined;
            if (link?.conversationId) {
              custom.links = {
                ...(custom.links as Record<string, unknown> | undefined),
                chat: {
                  conversation_id: link.conversationId,
                  contact_phone: phone,
                  contact_name: row.data.contact_name || link.contactName || null,
                },
              };
              summary.linkedToChat += 1;
            }

            return {
              pipeline_id: pipelineId,
              board_id: boardId,
              client_id: clientId,
              cod_agent: codAgent,
              title: row.data.title,
              description: row.data.description || null,
              value: row.data.value || 0,
              contact_name: row.data.contact_name || null,
              contact_phone: phone || null,
              contact_email: row.data.contact_email || null,
              priority: row.data.priority || 'medium',
              expected_close_date: row.data.expected_close_date || null,
              tags: row.data.tags || [],
              assigned_to: row.data.assigned_to || null,
              position: startPosition + offset + i,
              custom_fields: JSON.parse(JSON.stringify(custom)) as Json,
              created_by: userName || null,
              updated_by: userName || null,
            };
          });

          const { data: inserted, error } = await supabase
            .from('crm_deals')
            .insert(payload)
            .select('id');

          if (error) {
            summary.failed += chunk.length;
            summary.errors.push(
              `Linhas ${chunk[0].line}–${chunk[chunk.length - 1].line}: ${error.message}`,
            );
          } else {
            const ids = (inserted || []) as { id: string }[];
            summary.created += ids.length;
            // Histórico (não crítico — falha silenciosa como na criação individual)
            if (ids.length > 0) {
              const client = supabase as unknown as {
                from: (table: string) => {
                  insert: (data: Record<string, unknown>[]) => Promise<{ error: unknown }>;
                };
              };
              await client
                .from('crm_deal_history')
                .insert(
                  ids.map((d) => ({
                    deal_id: d.id,
                    action: 'created',
                    from_pipeline_id: null,
                    to_pipeline_id: pipelineId,
                    changes: { source: 'csv_import' },
                    changed_by: userName || codAgent,
                  })),
                )
                .catch?.(() => undefined);
            }
          }

          setProgress({ done: Math.min(offset + chunk.length, rows.length), total: rows.length });
        }
      } finally {
        setIsRunning(false);
      }

      return summary;
    },
    [boardId, clientId, codAgent, userName, resolveChatLinks],
  );

  return { run, isRunning, progress };
}
