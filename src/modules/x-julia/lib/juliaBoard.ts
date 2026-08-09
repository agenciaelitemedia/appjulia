/**
 * Garante o quadro único "CRM da Julia" no Construtor de CRM do escritório.
 * Usado quando o espelhamento é ligado em um agente X-Julia.
 */
import { supabase } from '../extend/db';

export const JULIA_BOARD_NAME = 'CRM da Julia';
export const JULIA_BOARD_SYSTEM_KEY = 'julia';

/** Etapas padrão da Julia (mesma ordem/cores do CRM X-Julia). */
export const JULIA_BOARD_STAGES: Array<{ name: string; stage_key: string; color: string }> = [
  { name: 'Novo lead', stage_key: 'recepcao', color: '#64748b' },
  { name: 'Triagem', stage_key: 'triagem', color: '#0ea5e9' },
  { name: 'Qualificação', stage_key: 'qualificacao', color: '#6366f1' },
  { name: 'Negociação', stage_key: 'negociacao', color: '#a855f7' },
  { name: 'Contrato enviado', stage_key: 'contrato', color: '#f59e0b' },
  { name: 'Assinado', stage_key: 'assinatura', color: '#22c55e' },
  { name: 'Agendado', stage_key: 'agendamento', color: '#14b8a6' },
  { name: 'Atendimento humano', stage_key: 'humano', color: '#f97316' },
  { name: 'Encerrado', stage_key: 'encerrado', color: '#ef4444' },
];

export async function ensureJuliaBoard(clientId: string | number, createdBy?: string | null) {
  const client = String(clientId);
  if (!client) return null;

  let { data: board } = await supabase
    .from('crm_boards')
    .select('id, cod_agent')
    .eq('client_id', client)
    .eq('system_key', JULIA_BOARD_SYSTEM_KEY)
    .maybeSingle();

  if (!board) {
    // Reaproveita quadro homônimo criado antes desta versão.
    const { data: legacy } = await supabase
      .from('crm_boards')
      .select('id, cod_agent')
      .eq('client_id', client)
      .eq('name', JULIA_BOARD_NAME)
      .maybeSingle();
    if (legacy) {
      await supabase
        .from('crm_boards')
        .update({ is_system: true, system_key: JULIA_BOARD_SYSTEM_KEY, is_archived: false } as any)
        .eq('id', legacy.id);
      board = legacy;
    }
  }

  if (!board) {
    const { data: created, error } = await supabase
      .from('crm_boards')
      .insert({
        client_id: client,
        cod_agent: '',
        name: JULIA_BOARD_NAME,
        description: 'Quadro gerenciado pela Julia (espelho das sessões do X-Julia)',
        icon: 'bot',
        color: '#6366f1',
        position: 0,
        is_system: true,
        system_key: JULIA_BOARD_SYSTEM_KEY,
        created_by: createdBy ?? 'x-julia',
      } as any)
      .select('id, cod_agent')
      .single();
    if (error) throw error;
    board = created;
  }

  const { data: stages } = await supabase
    .from('crm_pipelines')
    .select('id, stage_key')
    .eq('board_id', board.id);
  const existing = new Set((stages ?? []).map((s: any) => s.stage_key).filter(Boolean));
  const missing = JULIA_BOARD_STAGES.filter((s) => !existing.has(s.stage_key));
  if (missing.length > 0) {
    await supabase.from('crm_pipelines').insert(
      missing.map((s) => ({
        board_id: board!.id,
        client_id: client,
        cod_agent: board!.cod_agent ?? '',
        name: s.name,
        color: s.color,
        position: JULIA_BOARD_STAGES.findIndex((d) => d.stage_key === s.stage_key),
        is_system: true,
        stage_key: s.stage_key,
      })) as any,
    );
  }

  return board as { id: string; cod_agent: string | null };
}