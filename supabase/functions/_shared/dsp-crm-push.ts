/**
 * dsp-crm-push — cria card no CRM Builder a partir de um destinatário enviado.
 * Sempre isolado por client_id da campanha. Nunca lança para o worker:
 * o chamador deve tratar o retorno { ok, reason }.
 */
import { phoneVariants } from './dsp-core.ts';

export interface CrmPushResult {
  ok: boolean;
  reason?: string;
  deal_id?: string | null;
  contact_id?: string | null;
  created?: boolean;
  moved?: boolean;
}


export async function pushRecipientToCrm(
  admin: any,
  campaign: any,
  recipient: any,
): Promise<CrmPushResult> {
  const clientId = String(campaign?.client_id ?? '');
  const boardId = campaign?.crm_board_id ?? null;
  const pipelineId = campaign?.crm_pipeline_id ?? null;
  if (!clientId || !boardId || !pipelineId) return { ok: false, reason: 'crm_config_incomplete' };

  // 1) Painel e etapa devem pertencer ao mesmo escritório
  const { data: board } = await admin
    .from('crm_boards')
    .select('id, name, cod_agent, client_id')
    .eq('client_id', clientId)
    .eq('id', boardId)
    .maybeSingle();
  if (!board) return { ok: false, reason: 'board_not_found' };

  const { data: pipeline } = await admin
    .from('crm_pipelines')
    .select('id, name, board_id, cod_agent, is_active')
    .eq('client_id', clientId)
    .eq('id', pipelineId)
    .maybeSingle();
  if (!pipeline || pipeline.board_id !== board.id || pipeline.is_active === false) {
    return { ok: false, reason: 'pipeline_invalid' };
  }

  const phone = String(recipient?.phone_e164 ?? '').replace(/\D/g, '');
  if (!phone) return { ok: false, reason: 'phone_missing' };
  const variants = phoneVariants(phone);
  const leadName = String(recipient?.name ?? '').trim() || phone;

  // 2) Contato: reaproveita se já existir no escritório
  let contactId: string | null = recipient?.contact_id ?? null;
  if (contactId) {
    const { data: existing } = await admin
      .from('chat_contacts')
      .select('id')
      .eq('client_id', clientId)
      .eq('id', contactId)
      .maybeSingle();
    if (!existing) contactId = null;
  }
  if (!contactId) {
    const { data: found } = await admin
      .from('chat_contacts')
      .select('id, phone')
      .eq('client_id', clientId)
      .eq('is_group', false)
      .in('phone', variants)
      .limit(1);
    if (found && found.length > 0) contactId = found[0].id;
  }
  if (!contactId) {
    const { data: created, error } = await admin
      .from('chat_contacts')
      .insert({
        client_id: clientId,
        phone,
        name: leadName,
        channel_type: 'whatsapp',
        cod_agent: board.cod_agent ?? null,
        is_group: false,
      })
      .select('id')
      .maybeSingle();
    if (error) return { ok: false, reason: `contact_insert:${error.message}` };
    contactId = created?.id ?? null;
  }

  // 2.1) Conversa mais recente do contato (para o vínculo padrão chat↔CRM)
  let conversationId: string | null = null;
  if (contactId) {
    const { data: conv } = await admin
      .from('chat_conversations')
      .select('id')
      .eq('client_id', clientId)
      .eq('contact_id', contactId)
      .order('updated_at', { ascending: false, nullsFirst: false })
      .limit(1);
    conversationId = conv?.[0]?.id ?? null;
  }

  const chatLink: Record<string, unknown> = {
    contact_id: contactId,
    contact_phone: phone,
    ...(conversationId ? { conversation_id: conversationId } : {}),
    linked_by: `dsp:${campaign.id}`,
    linked_at: new Date().toISOString(),
  };

  // 3) Card ativo (status open) no mesmo painel → move para a etapa da campanha.
  //    Arquivado / ganho / perdido NÃO conta: um card novo é criado.
  const { data: active } = await admin
    .from('crm_deals')
    .select('id, pipeline_id, custom_fields')
    .eq('client_id', clientId)
    .eq('board_id', board.id)
    .in('contact_phone', variants)
    .eq('status', 'open')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (active && active.length > 0) {
    const deal = active[0];
    const nowIso = new Date().toISOString();

    // Garante o vínculo padrão chat↔CRM no card existente (sem sobrescrever o que já existe)
    const existingCf = (deal.custom_fields ?? {}) as Record<string, any>;
    const existingLinks = (existingCf.links ?? {}) as Record<string, any>;
    const mergedCustomFields = {
      ...existingCf,
      dsp_campaign_id: campaign.id,
      dsp_contact_id: contactId,
      links: { ...existingLinks, chat: { ...chatLink, ...(existingLinks.chat ?? {}) } },
    };


    if (deal.pipeline_id !== pipeline.id) {
      const { data: lastDest } = await admin
        .from('crm_deals')
        .select('position')
        .eq('client_id', clientId)
        .eq('pipeline_id', pipeline.id)
        .order('position', { ascending: false })
        .limit(1);
      const destPosition = ((lastDest?.[0]?.position as number | undefined) ?? -1) + 1;

      const patch: Record<string, unknown> = {
        pipeline_id: pipeline.id,
        stage_entered_at: nowIso,
        position: destPosition,
        updated_by: `dsp:${campaign.id}`,
        custom_fields: mergedCustomFields,
      };
      if (campaign?.crm_assigned_to) patch.assigned_to = campaign.crm_assigned_to;

      const { error: updError } = await admin.from('crm_deals').update(patch).eq('id', deal.id);
      if (updError) return { ok: false, reason: `deal_update:${updError.message}`, deal_id: deal.id, contact_id: contactId };

      await admin.from('crm_deal_history').insert({
        deal_id: deal.id,
        action: 'stage_changed',
        from_pipeline_id: deal.pipeline_id,
        to_pipeline_id: pipeline.id,
        changed_by: `dsp:${campaign.id}`,
        notes: `Card movido para "${pipeline.name}" pela campanha de disparo "${campaign.name ?? campaign.id}"`,
      });

      return { ok: true, created: false, moved: true, deal_id: deal.id, contact_id: contactId, reason: 'deal_moved' };
    }

    await admin.from('crm_deals').update({ custom_fields: mergedCustomFields }).eq('id', deal.id);

    await admin.from('crm_deal_history').insert({
      deal_id: deal.id,
      action: 'note',
      to_pipeline_id: pipeline.id,
      changed_by: `dsp:${campaign.id}`,
      notes: `Contato incluído novamente pela campanha de disparo "${campaign.name ?? campaign.id}" (já estava em "${pipeline.name}")`,
    });

    return { ok: true, created: false, moved: false, deal_id: deal.id, contact_id: contactId, reason: 'already_in_stage' };
  }


  const { data: last } = await admin
    .from('crm_deals')
    .select('position')
    .eq('client_id', clientId)
    .eq('pipeline_id', pipeline.id)
    .order('position', { ascending: false })
    .limit(1);
  const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;

  const now = new Date().toISOString();
  const row: Record<string, unknown> = {
    client_id: clientId,
    board_id: board.id,
    pipeline_id: pipeline.id,
    cod_agent: pipeline.cod_agent ?? board.cod_agent,
    title: leadName,
    contact_name: leadName,
    contact_phone: phone,
    status: 'open',
    position,
    stage_entered_at: now,
    assigned_to: campaign?.crm_assigned_to ?? null,
    created_by: `dsp:${campaign.id}`,
    custom_fields: { dsp_campaign_id: campaign.id, dsp_contact_id: contactId },
  };

  const { data: deal, error: dealError } = await admin
    .from('crm_deals')
    .insert(row)
    .select('id')
    .maybeSingle();
  if (dealError) return { ok: false, reason: `deal_insert:${dealError.message}` };

  if (deal?.id) {
    await admin.from('crm_deal_history').insert({
      deal_id: deal.id,
      action: 'created',
      to_pipeline_id: pipeline.id,
      changed_by: `dsp:${campaign.id}`,
      notes: `Card criado pela campanha de disparo "${campaign.name ?? campaign.id}"`,
    });
  }

  return { ok: true, created: true, deal_id: deal?.id ?? null, contact_id: contactId };
}
