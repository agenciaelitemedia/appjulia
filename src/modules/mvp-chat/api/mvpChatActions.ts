/**
 * Ações do JulIA Chat sobre a conversa (atribuir / assumir / devolver p/ fila).
 * Espelha as regras já usadas no /chat (WhatsAppDataContext + ChatHeader),
 * mas isoladas no módulo para não alterar nada do chat principal.
 */
import { supabase } from '../extend/db';
import { externalDb } from '@/lib/externalDb';

interface Actor {
  name?: string | null;
  id?: number | string | null;
}

/** Desativa a Júlia + follow-ups quando um humano assume/transfere. */
async function disableJuliaOnAssign(args: {
  contactPhone?: string | null;
  queueId?: string | null;
  userId?: number | null;
}) {
  const cleanPhone = args.contactPhone?.replace(/\D/g, '') ?? '';
  if (!cleanPhone || !args.queueId || !args.userId) return;
  try {
    const { data: links } = await supabase
      .from('queue_agent_links')
      .select('cod_agent, is_primary')
      .eq('queue_id', args.queueId);
    if (!links || links.length === 0) return;
    const primary = links.find((l: any) => l.is_primary) || links[0];
    const codAgent = primary?.cod_agent ? String(primary.cod_agent) : null;
    if (!codAgent) return;

    const session = await externalDb.getSessionStatus(cleanPhone, codAgent);
    if (session?.id && session.active !== false) {
      await externalDb.updateSessionStatus(session.id, false);
    }
    try {
      await supabase.functions.invoke('n8n_execute-followup-stop', {
        body: { codAgent, sessionId: cleanPhone },
      });
    } catch (e) {
      console.warn('[mvp-chat] followup-stop falhou', e);
    }
  } catch (e) {
    console.warn('[mvp-chat] disableJulia falhou', e);
  }
}

/** Atribui a conversa a um responsável (opcionalmente abrindo o atendimento). */
export async function mvpAssignConversation(params: {
  conversationId: string;
  assignedTo: string;
  assignedUserId: number | null;
  actor: Actor;
  openConversation?: boolean;
  currentStatus?: string;
  contactPhone?: string | null;
  queueId?: string | null;
}) {
  const {
    conversationId, assignedTo, assignedUserId, actor,
    openConversation, currentStatus, contactPhone, queueId,
  } = params;

  const updates: Record<string, unknown> = {
    assigned_to: assignedTo,
    assigned_user_id: assignedUserId,
  };
  if (openConversation && currentStatus === 'pending') updates.status = 'open';

  const { error } = await supabase.from('chat_conversations').update(updates).eq('id', conversationId);
  if (error) throw error;

  await supabase.from('chat_conversation_history').insert({
    conversation_id: conversationId,
    action: 'assigned',
    actor_name: actor.name || 'Sistema',
    to_value: assignedTo,
    to_user_id: assignedUserId ?? null,
    user_id: actor.id ? Number(actor.id) : null,
  });

  await disableJuliaOnAssign({
    contactPhone,
    queueId,
    userId: actor.id ? Number(actor.id) : null,
  });
}

/** Devolve a conversa para a fila — remove responsável e volta para "pending". */
export async function mvpReturnToQueue(params: {
  conversationId: string;
  actor: Actor;
  removedAgent?: string | null;
  removedUserId?: number | null;
  note?: string;
}) {
  const { conversationId, actor, removedAgent, removedUserId, note } = params;

  const { error } = await supabase
    .from('chat_conversations')
    .update({ assigned_to: null, assigned_user_id: null, status: 'pending' })
    .eq('id', conversationId);
  if (error) throw error;

  const { error: histErr } = await supabase.from('chat_conversation_history').insert({
    conversation_id: conversationId,
    action: 'returned_to_queue',
    actor_name: actor.name || 'Sistema',
    from_value: removedAgent || null,
    from_user_id: removedUserId ?? null,
    user_id: actor.id ? Number(actor.id) : null,
    to_value: 'pending',
    notes: note?.trim() || null,
  });
  if (histErr) throw histErr;
}
