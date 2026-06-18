import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';
import type {
  SupportTicket, TicketMessage, SupportDepartment, SupportCategory, SupportSettings,
  TicketStatus, TicketPriority, TicketRole,
} from '../types';

// Supabase types não incluem as tabelas de helpdesk; usamos cast (precedente do projeto).
const db = supabase as any;

// ── Papel do usuário no helpdesk ──
export function useTicketRole(): TicketRole {
  const { isAdmin, user } = useAuth();
  if (isAdmin) return 'agent';                 // suporte Julia
  if (user?.role === 'user') return 'manager'; // dono do escritório
  // Membros do escritório (time/advogado/colaborador/comercial) também enxergam
  // os chamados do client_id do escritório.
  if (user) return 'manager';
  return 'requester';
}

export interface TicketFilters {
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  assigned?: string | 'all';
  department_id?: string | 'all';
  search?: string;
  overdueOnly?: boolean;
}

// ── Lista de tickets (escopo por papel) ──
export function useTickets(filters: TicketFilters = {}) {
  const { user } = useAuth();
  const role = useTicketRole();
  const qc = useQueryClient();
  const userId = user?.id != null ? String(user.id) : null;

  const query = useQuery({
    queryKey: ['support-tickets', role, userId, user?.client_id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const effectiveClientId = await resolveEffectiveClientId(user, 'useTickets');
      let q = db.from('support_tickets')
        .select('*')
        .neq('status', 'closed')
        .order('created_at', { ascending: false })
        .limit(500);
      if (role === 'requester') q = q.eq('requester_user_id', userId);
      else if (role === 'manager') {
        if (!effectiveClientId) return [] as SupportTicket[];
        q = q.eq('requester_client_id', effectiveClientId);
      }
      // agent (admin) → todos (exceto fechados)
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('support-tickets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => {
        qc.invalidateQueries({ queryKey: ['support-tickets'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  // Filtros client-side
  const f = filters;
  const tickets = (query.data || []).filter((t) => {
    if (f.status && f.status !== 'all' && t.status !== f.status) return false;
    if (f.priority && f.priority !== 'all' && t.priority !== f.priority) return false;
    if (f.assigned && f.assigned !== 'all' && t.assigned_to !== f.assigned) return false;
    if (f.department_id && f.department_id !== 'all' && t.department_id !== f.department_id) return false;
    if (f.overdueOnly && !isOverdue(t)) return false;
    if (f.search) {
      const s = f.search.toLowerCase();
      const hay = `#${t.number ?? ''} ${t.subject} ${t.requester_name ?? ''} ${t.requester_email ?? ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  return { tickets, isLoading: query.isLoading, role };
}

// ── Um ticket + thread ──
export function useTicket(id: string | undefined) {
  const qc = useQueryClient();

  const ticketQ = useQuery({
    queryKey: ['support-ticket', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db.from('support_tickets').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as SupportTicket | null;
    },
  });

  const messagesQ = useQuery({
    queryKey: ['support-ticket-messages', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await db.from('support_ticket_messages')
        .select('*').eq('ticket_id', id).order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as TicketMessage[];
    },
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`support-ticket-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_ticket_messages', filter: `ticket_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ['support-ticket-messages', id] }))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'support_tickets', filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ['support-ticket', id] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, qc]);

  return { ticket: ticketQ.data ?? null, messages: messagesQ.data || [], isLoading: ticketQ.isLoading };
}

// ── Configuração (departamentos / categorias / SLA / CSAT) ──
export function useSupportConfig() {
  const qc = useQueryClient();
  const departments = useQuery({
    queryKey: ['support-departments'],
    queryFn: async () => {
      const { data } = await db.from('support_departments').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as SupportDepartment[];
    },
  });
  const categories = useQuery({
    queryKey: ['support-categories'],
    queryFn: async () => {
      const { data } = await db.from('support_categories').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as SupportCategory[];
    },
  });
  const settings = useQuery({
    queryKey: ['support-settings'],
    queryFn: async () => {
      const { data } = await db.from('support_settings').select('*').eq('id', 'global').maybeSingle();
      return data as SupportSettings | null;
    },
  });

  return {
    departments: departments.data || [],
    categories: categories.data || [],
    settings: settings.data ?? null,
    isLoading: departments.isLoading || categories.isLoading || settings.isLoading,
    invalidate: () => {
      qc.invalidateQueries({ queryKey: ['support-departments'] });
      qc.invalidateQueries({ queryKey: ['support-categories'] });
      qc.invalidateQueries({ queryKey: ['support-settings'] });
    },
  };
}

export class WhatsappDispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WhatsappDispatchError';
  }
}

async function dispatchToWhatsApp(params: {
  ticketId: string;
  queueId: string;
  contactId: string;
  conversationId: string | null;
  body: string;
  senderName: string | null;
  media?: { url: string; mimetype: string; fileName: string; type: 'image'; caption?: string | null } | null;
}): Promise<{ queueName: string | null }> {
  const { ticketId, queueId, contactId, conversationId, body, senderName, media } = params;
  const { data: queue, error: qerr } = await db
    .from('queues')
    .select('id, name, channel_type, evo_url, evo_apikey, waba_token, waba_number_id')
    .eq('id', queueId)
    .maybeSingle();
  if (qerr || !queue) throw new WhatsappDispatchError('Fila não encontrada');

  const { data: contact, error: cerr } = await db
    .from('chat_contacts')
    .select('id, phone, client_id')
    .eq('id', contactId)
    .maybeSingle();
  if (cerr || !contact?.phone) throw new WhatsappDispatchError('Contato sem telefone');

  let externalMessageId: string | undefined;
  try {
    if (queue.channel_type === 'waba') {
      if (!queue.waba_token || !queue.waba_number_id) {
        throw new WhatsappDispatchError('Credenciais WABA ausentes na fila');
      }
      const wabaPayload = media
        ? {
            messaging_product: 'whatsapp',
            to: contact.phone,
            type: 'image',
            image: { link: media.url, caption: media.caption || body || undefined },
          }
        : {
            messaging_product: 'whatsapp',
            to: contact.phone,
            type: 'text',
            text: { body },
          };
      const r = await fetch(`https://graph.facebook.com/v22.0/${queue.waba_number_id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${queue.waba_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(wabaPayload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new WhatsappDispatchError(`WABA ${r.status}: ${j?.error?.message || 'falha no envio'}`);
      externalMessageId = j?.messages?.[0]?.id;
    } else {
      if (!queue.evo_url || !queue.evo_apikey) {
        throw new WhatsappDispatchError('Credenciais UaZapi ausentes na fila');
      }
      const baseUrl = String(queue.evo_url).replace(/\/+$/, '');
      const endpoint = media ? `${baseUrl}/send/media` : `${baseUrl}/send/text`;
      const reqBody = media
        ? {
            number: contact.phone,
            type: 'image',
            file: media.url,
            text: media.caption || body || '',
            fileName: media.fileName,
          }
        : { number: contact.phone, text: body, linkPreview: true };
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', token: String(queue.evo_apikey) },
        body: JSON.stringify(reqBody),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new WhatsappDispatchError(`UaZapi ${r.status}: ${j?.error || j?.message || 'falha no envio'}`);
      externalMessageId = j?.messageId || j?.id || j?.data?.messageId;
    }
  } catch (e) {
    if (e instanceof WhatsappDispatchError) throw e;
    throw new WhatsappDispatchError((e as Error).message || 'Erro ao enviar WhatsApp');
  }

  // Persistir na conversa para aparecer no histórico do chat
  try {
    const previewText = media ? (media.caption || body || '📷 Imagem') : body;
    await db.from('chat_messages').insert({
      contact_id: contactId,
      client_id: contact.client_id,
      conversation_id: conversationId,
      text: media ? (media.caption || body || null) : body,
      caption: media ? (media.caption || body || null) : null,
      type: media ? media.type : 'text',
      media_url: media?.url ?? null,
      from_me: true,
      status: 'sent',
      message_id: externalMessageId,
      external_id: externalMessageId,
      timestamp: new Date().toISOString(),
      sender_name: senderName || 'Suporte',
      metadata: media
        ? { support_ticket_id: ticketId, mimetype: media.mimetype, attachment_bucket: 'ticket-media' }
        : { support_ticket_id: ticketId },
    });
    await db.from('chat_contacts').update({
      last_message_at: new Date().toISOString(),
      last_message_text: previewText,
    }).eq('id', contactId);
  } catch (e) {
    console.error('[dispatchToWhatsApp] persist failed', e);
  }

  return { queueName: (queue.name as string | null) ?? null };
}

// ── Mutations ──
export interface CreateTicketInput {
  subject: string;
  description?: string;
  priority: TicketPriority;
  department_id?: string | null;
  category_id?: string | null;
  requester_name?: string;
  requester_email?: string;
  requester_phone?: string;
  conversation_id?: string | null;
  contact_id?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function useTicketMutations() {
  const { user } = useAuth();
  const role = useTicketRole();
  const qc = useQueryClient();
  const actor = { id: user?.id != null ? String(user.id) : null, name: user?.name ?? null };

  const invalidate = (ticketId?: string) => {
    qc.invalidateQueries({ queryKey: ['support-tickets'] });
    if (ticketId) {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      qc.invalidateQueries({ queryKey: ['support-ticket-messages', ticketId] });
    }
  };

  const logEvent = async (ticketId: string, eventType: string, body: string) => {
    await db.from('support_ticket_messages').insert({
      ticket_id: ticketId, author_user_id: actor.id, author_name: actor.name,
      author_role: 'system', kind: 'event', event_type: eventType, body,
    });
  };

  const create = useMutation({
    mutationFn: async (input: CreateTicketInput) => {
      // SLA due dates from settings/priority
      const { data: settings } = await db.from('support_settings')
        .select('sla, protocol_auto_send, protocol_send_template')
        .eq('id', 'global').maybeSingle();
      const sla = settings?.sla?.[input.priority];
      const now = Date.now();
      const effectiveClientId = await resolveEffectiveClientId(user, 'useTickets.create');
      const payload = {
        subject: input.subject,
        description: input.description ?? null,
        status: 'open',
        priority: input.priority,
        department_id: input.department_id ?? null,
        category_id: input.category_id ?? null,
        requester_user_id: actor.id,
        requester_client_id: effectiveClientId,
        requester_name: input.requester_name ?? user?.name ?? null,
        requester_email: input.requester_email ?? user?.email ?? null,
        requester_phone: input.requester_phone ?? null,
        conversation_id: input.conversation_id ?? null,
        contact_id: input.contact_id ?? null,
        assigned_to: input.assigned_to ?? null,
        assigned_to_name: input.assigned_to_name ?? null,
        assigned_user_id: input.assigned_to ? Number(input.assigned_to) || null : null,
        metadata: input.metadata ?? {},
        sla_first_response_due_at: sla ? new Date(now + sla.firstResponseMins * 60000).toISOString() : null,
        sla_resolution_due_at: sla ? new Date(now + sla.resolutionMins * 60000).toISOString() : null,
      };
      // Gera protocolo no client via RPC (atômico). Trigger no banco serve como fallback.
      let protocol: string | null = null;
      try {
        const { protocolService } = await import('@/lib/protocol');
        protocol = await protocolService.generateForSupportTicket();
      } catch { /* fallback no trigger */ }
      const finalPayload = protocol ? { ...payload, protocol } : payload;
      const { data, error } = await db.from('support_tickets').insert(finalPayload).select('id, protocol, number').single();
      if (error) throw error;
      await logEvent(data.id, 'created', 'Chamado aberto');

      // Envio automático do protocolo via WhatsApp (se habilitado)
      if (settings?.protocol_auto_send && input.contact_id && data.protocol) {
        try {
          let queueId: string | null = null;
          if (input.conversation_id) {
            const { data: conv } = await db.from('chat_conversations')
              .select('queue_id').eq('id', input.conversation_id).maybeSingle();
            queueId = conv?.queue_id ?? null;
          }
          if (queueId) {
            const tpl = (settings.protocol_send_template as string) || 'Protocolo: {protocolo}';
            const body = tpl
              .replace(/\{protocolo\}/g, String(data.protocol))
              .replace(/\{numero\}/g, data.number != null ? String(data.number) : '')
              .replace(/\{assunto\}/g, input.subject || '')
              .replace(/\{nome\}/g, input.requester_name ?? user?.name ?? '')
              .replace(/\{prioridade\}/g, input.priority);
            await dispatchToWhatsApp({
              ticketId: data.id,
              queueId,
              contactId: input.contact_id,
              conversationId: input.conversation_id ?? null,
              body,
              senderName: actor.name,
            });
            await logEvent(data.id, 'whatsapp_protocol_sent', 'Protocolo enviado automaticamente ao WhatsApp do solicitante');
          }
        } catch (e) {
          console.warn('[useTickets.create] auto-send protocol failed', e);
        }
      }

      return data.id as string;
    },
    onSuccess: () => invalidate(),
  });

  const reply = useMutation({
    mutationFn: async ({
      ticketId, body, internal, sendToWhatsApp, attachment, attachments, whatsappBody,
    }: {
      ticketId: string;
      body: string;
      internal: boolean;
      sendToWhatsApp?: { contactId: string; queueId: string; conversationId: string | null };
      attachment?: File | null;
      attachments?: File[];
      whatsappBody?: string;
    }) => {
      // Normaliza lista de anexos (suporta múltiplas imagens; compat: `attachment`).
      const files: File[] = [
        ...(attachments ?? []),
        ...(attachment ? [attachment] : []),
      ];
      type UploadedMedia = { url: string; mimetype: string; fileName: string; type: 'image' };
      const uploaded: UploadedMedia[] = [];
      let uploadFailed = false;
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
          r.onerror = reject;
          r.readAsDataURL(file);
        });
        try {
          const { data, error } = await db.functions.invoke('ticket-media-upload', {
            body: {
              base64,
              mimetype: file.type || 'application/octet-stream',
              fileName: file.name,
              ticketId,
              source: 'outgoing',
            },
          });
          if (error) throw error;
          if (data?.url) {
            uploaded.push({
              url: data.url as string,
              mimetype: (data.mimetype as string) || file.type || 'application/octet-stream',
              fileName: file.name,
              type: 'image',
            });
          } else {
            uploadFailed = true;
          }
        } catch (e) {
          uploadFailed = true;
          console.warn('[ticket reply] upload failed (continuing):', e);
        }
      }

      const attachmentsForRow = uploaded.length > 0
        ? uploaded.map((u) => ({ type: u.type, url: u.url, mimetype: u.mimetype, file_name: u.fileName }))
        : null;

      const { data: inserted, error: insertError } = await db
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId, author_user_id: actor.id, author_name: actor.name,
          author_role: role === 'agent' ? 'agent' : 'requester',
          kind: internal ? 'internal' : 'public',
          body: body || null,
          attachments: attachmentsForRow as unknown as object | null,
        })
        .select('id')
        .single();
      if (insertError) throw insertError;
      const who = actor.name || (role === 'agent' ? 'Suporte' : 'Solicitante');
      await logEvent(
        ticketId,
        internal ? 'note_added' : 'reply_added',
        internal ? `Nota interna adicionada por ${who}` : `Resposta enviada por ${who}`,
      );
      // Primeira resposta do agente → marca first_response_at
      if (role === 'agent' && !internal) {
        const { data: t } = await db.from('support_tickets').select('first_response_at').eq('id', ticketId).maybeSingle();
        if (t && !t.first_response_at) {
          await db.from('support_tickets').update({ first_response_at: new Date().toISOString() }).eq('id', ticketId);
        }
      }
      // Envio opcional ao WhatsApp do solicitante
      if (!internal && sendToWhatsApp?.queueId && sendToWhatsApp?.contactId) {
        if (files.length > 0 && uploaded.length !== files.length) {
          throw new WhatsappDispatchError('Falha ao subir uma ou mais imagens para envio ao WhatsApp');
        }
      let queueLabel: string | null = null;
        const dispatchBody = (whatsappBody ?? body) || '';
        if (uploaded.length > 0) {
          // Envia cada imagem como mensagem de mídia. Caption só na primeira (com o texto).
          for (let i = 0; i < uploaded.length; i++) {
            const u = uploaded[i];
            const caption = i === 0 ? (dispatchBody || null) : null;
            const { queueName } = await dispatchToWhatsApp({
              ticketId,
              queueId: sendToWhatsApp.queueId,
              contactId: sendToWhatsApp.contactId,
              conversationId: sendToWhatsApp.conversationId,
              body: caption ?? '',
              senderName: actor.name,
              media: { url: u.url, mimetype: u.mimetype, fileName: u.fileName, type: 'image', caption },
            });
            queueLabel = queueName;
          }
        } else {
          const { queueName } = await dispatchToWhatsApp({
            ticketId,
            queueId: sendToWhatsApp.queueId,
            contactId: sendToWhatsApp.contactId,
            conversationId: sendToWhatsApp.conversationId,
            body: dispatchBody,
            senderName: actor.name,
          });
          queueLabel = queueName;
        }
        await logEvent(
          ticketId,
          'whatsapp_sent',
          `Resposta${uploaded.length > 0 ? ` com ${uploaded.length} imagem(ns)` : ''} enviada ao WhatsApp do solicitante${queueLabel ? ` via fila ${queueLabel}` : ''}`,
        );
      }
      return inserted?.id as string | undefined;
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const editMessage = useMutation({
    mutationFn: async ({ ticketId, messageId, body }: { ticketId: string; messageId: string; body: string }) => {
      const { error } = await db
        .from('support_ticket_messages')
        .update({ body })
        .eq('id', messageId);
      if (error) throw error;
      const who = actor.name || (role === 'agent' ? 'Suporte' : 'Solicitante');
      await logEvent(ticketId, 'message_edited', `Mensagem editada por ${who}`);
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const deleteMessage = useMutation({
    mutationFn: async ({ ticketId, messageId, kind }: { ticketId: string; messageId: string; kind: 'public' | 'internal' }) => {
      const { error } = await db
        .from('support_ticket_messages')
        .delete()
        .eq('id', messageId);
      if (error) throw error;
      const who = actor.name || (role === 'agent' ? 'Suporte' : 'Solicitante');
      await logEvent(
        ticketId,
        'message_deleted',
        kind === 'internal' ? `Nota interna excluída por ${who}` : `Resposta excluída por ${who}`,
      );
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const setStatus = useMutation({
    mutationFn: async ({ ticketId, status }: { ticketId: string; status: TicketStatus }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'resolved') patch.resolved_at = new Date().toISOString();
      if (status === 'closed') patch.closed_at = new Date().toISOString();
      const { data: prev } = await db.from('support_tickets').select('status, reopened_count').eq('id', ticketId).maybeSingle();
      const wasClosed = prev && ['resolved', 'closed'].includes(prev.status);
      if (wasClosed && ['open', 'pending', 'in_progress', 'waiting_customer'].includes(status)) {
        patch.reopened_count = (prev?.reopened_count ?? 0) + 1;
        patch.resolved_at = null; patch.closed_at = null;
      }
      await db.from('support_tickets').update(patch).eq('id', ticketId);
      await logEvent(ticketId, 'status_change', `Status: ${status}`);
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const update = useMutation({
    mutationFn: async ({ ticketId, patch, event }: { ticketId: string; patch: Record<string, unknown>; event?: string }) => {
      const finalPatch: Record<string, unknown> = { ...patch };
      if (typeof patch.priority === 'string') {
        const [{ data: settings }, { data: t }] = await Promise.all([
          db.from('support_settings').select('sla').eq('id', 'global').maybeSingle(),
          db.from('support_tickets').select('opened_at, created_at, first_response_at, status').eq('id', ticketId).maybeSingle(),
        ]);
        const sla = settings?.sla?.[patch.priority as string];
        if (sla && t && !['resolved', 'closed'].includes(t.status)) {
          const anchor = new Date(t.opened_at ?? t.created_at).getTime();
          if (!t.first_response_at) {
            finalPatch.sla_first_response_due_at = new Date(anchor + sla.firstResponseMins * 60000).toISOString();
          }
          finalPatch.sla_resolution_due_at = new Date(anchor + sla.resolutionMins * 60000).toISOString();
        }
      }
      await db.from('support_tickets').update(finalPatch).eq('id', ticketId);
      if (event) await logEvent(ticketId, 'updated', event);
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const assign = useMutation({
    mutationFn: async ({ ticketId, assignedTo, assignedToName }: { ticketId: string; assignedTo: string | null; assignedToName: string | null }) => {
      await db.from('support_tickets').update({
        assigned_to: assignedTo,
        assigned_to_name: assignedToName,
        assigned_user_id: assignedTo ? Number(assignedTo) || null : null,
      }).eq('id', ticketId);
      await logEvent(ticketId, 'assigned', assignedToName ? `Atribuído a ${assignedToName}` : 'Atribuição removida');
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const setCsat = useMutation({
    mutationFn: async ({ ticketId, score, comment }: { ticketId: string; score: number; comment?: string }) => {
      await db.from('support_tickets').update({ csat_score: score, csat_comment: comment ?? null, csat_at: new Date().toISOString() }).eq('id', ticketId);
      await logEvent(ticketId, 'csat', `Avaliação: ${score}/5`);
    },
    onSuccess: (_d, v) => invalidate(v.ticketId),
  });

  const deleteTicket = useMutation({
    mutationFn: async (ticketId: string) => {
      await db.from('support_tickets').delete().eq('id', ticketId);
    },
    onSuccess: () => invalidate(),
  });

  return { create, reply, editMessage, deleteMessage, setStatus, update, assign, setCsat, deleteTicket };
}

// ── Mutations de configuração (departamentos / categorias / SLA / CSAT) ──
export function useSupportConfigMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['support-departments'] });
    qc.invalidateQueries({ queryKey: ['support-categories'] });
    qc.invalidateQueries({ queryKey: ['support-settings'] });
  };

  const saveDepartment = useMutation({
    mutationFn: async (d: Partial<SupportDepartment> & { name: string }) => {
      if (d.id) await db.from('support_departments').update({ name: d.name, is_active: d.is_active ?? true }).eq('id', d.id);
      else await db.from('support_departments').insert({ name: d.name });
    },
    onSuccess: invalidate,
  });
  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => { await db.from('support_departments').update({ is_active: false }).eq('id', id); },
    onSuccess: invalidate,
  });

  const saveCategory = useMutation({
    mutationFn: async (c: Partial<SupportCategory> & { name: string }) => {
      if (c.id) await db.from('support_categories').update({ name: c.name, department_id: c.department_id ?? null, is_active: c.is_active ?? true }).eq('id', c.id);
      else await db.from('support_categories').insert({ name: c.name, department_id: c.department_id ?? null });
    },
    onSuccess: invalidate,
  });
  const deleteCategory = useMutation({
    mutationFn: async (id: string) => { await db.from('support_categories').update({ is_active: false }).eq('id', id); },
    onSuccess: invalidate,
  });

  const saveSettings = useMutation({
    mutationFn: async (patch: Partial<SupportSettings>) => {
      await db.from('support_settings').update(patch).eq('id', 'global');
    },
    onSuccess: invalidate,
  });

  const reapplySlaToOpenTickets = useMutation({
    mutationFn: async (slaOverride?: Record<string, { firstResponseMins: number; resolutionMins: number }>) => {
      let sla = slaOverride;
      if (!sla) {
        const { data: settings } = await db.from('support_settings').select('sla').eq('id', 'global').maybeSingle();
        sla = settings?.sla ?? {};
      }
      const { data: tickets, error } = await db.from('support_tickets')
        .select('id, priority, opened_at, created_at, first_response_at, status')
        .not('status', 'in', '(resolved,closed)');
      if (error) throw error;
      let updated = 0;
      for (const t of tickets || []) {
        const cfg = sla?.[t.priority as string];
        if (!cfg) continue;
        const anchor = new Date(t.opened_at ?? t.created_at).getTime();
        const patch: Record<string, unknown> = {
          sla_resolution_due_at: new Date(anchor + cfg.resolutionMins * 60000).toISOString(),
        };
        if (!t.first_response_at) {
          patch.sla_first_response_due_at = new Date(anchor + cfg.firstResponseMins * 60000).toISOString();
        }
        await db.from('support_tickets').update(patch).eq('id', t.id);
        updated++;
      }
      qc.invalidateQueries({ queryKey: ['support-tickets'] });
      qc.invalidateQueries({ queryKey: ['support-ticket'] });
      return updated;
    },
  });

  return { saveDepartment, deleteDepartment, saveCategory, deleteCategory, saveSettings, reapplySlaToOpenTickets };
}

// ── SLA helpers ──
export function isOverdue(t: SupportTicket): boolean {
  if (['resolved', 'closed'].includes(t.status)) return false;
  const now = Date.now();
  if (!t.first_response_at && t.sla_first_response_due_at && new Date(t.sla_first_response_due_at).getTime() < now) return true;
  if (t.sla_resolution_due_at && new Date(t.sla_resolution_due_at).getTime() < now) return true;
  return false;
}

export type TicketSlaStatus = 'on_track' | 'at_risk' | 'breached' | 'unknown';
export type TicketSlaType = 'frt' | 'ttr';

export interface TicketSlaEvaluation {
  status: TicketSlaStatus;
  slaType: TicketSlaType;
  slaTypeLabel: string;
  remainingMinutes: number;
  targetMinutes: number;
}

export function evaluateTicketSla(t: SupportTicket): TicketSlaEvaluation {
  if (['resolved', 'closed'].includes(t.status)) {
    return { status: 'on_track', slaType: 'ttr', slaTypeLabel: 'Resolução', remainingMinutes: 0, targetMinutes: 0 };
  }
  const now = Date.now();
  const openedAt = t.opened_at ? new Date(t.opened_at).getTime() : (t.created_at ? new Date(t.created_at).getTime() : now);

  const classify = (dueIso: string, slaType: TicketSlaType, slaTypeLabel: string): TicketSlaEvaluation => {
    const due = new Date(dueIso).getTime();
    const targetMinutes = Math.max(1, Math.round((due - openedAt) / 60000));
    const remainingMinutes = Math.round((due - now) / 60000);
    let status: TicketSlaStatus = 'on_track';
    if (remainingMinutes < 0) status = 'breached';
    else if (remainingMinutes <= targetMinutes * 0.25) status = 'at_risk';
    return { status, slaType, slaTypeLabel, remainingMinutes, targetMinutes };
  };

  if (!t.first_response_at && t.sla_first_response_due_at) {
    return classify(t.sla_first_response_due_at, 'frt', '1ª Resposta');
  }
  if (t.sla_resolution_due_at) {
    return classify(t.sla_resolution_due_at, 'ttr', 'Resolução');
  }
  return { status: 'unknown', slaType: 'ttr', slaTypeLabel: '', remainingMinutes: 0, targetMinutes: 0 };
}
