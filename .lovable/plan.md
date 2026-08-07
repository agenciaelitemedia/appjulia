# X-Julia — Ativação do agente (frases, horário de atendimento e áudio)

Objetivo: dar ao agente X-Julia as mesmas configurações de ativação que o agente Julia clássico já tem em `/admin/agentes/:id/editar`, dentro do editor do agente X-Julia (nova aba "Ativação"), e fazer o motor respeitá-las.

## O que será criado na UI

Nova aba **Ativação** no editor do agente X-Julia (`/x-julia/agentes/:id`), com 3 blocos no mesmo padrão visual do agente Julia (cards + switches + listas de frases com `MultiPhraseInput`):

1. Sessão e Campanha
   - Início da Sessão — múltiplas frases que iniciam uma nova sessão (ex.: `#start`).
   - Apenas Campanha — responder somente leads vindos de campanha.
   - Início de Campanha — múltiplas frases que abrem o fluxo de campanha.
   - Verificar Atendimento Especializado — múltiplas frases que transferem direto para humano.
2. Áudio
   - Usar Áudio (respostas em áudio) — ligar/desligar. Passa a ser controlado também aqui, refletindo o mesmo campo já existente na aba "LLM & Voz" (um único valor, dois lugares para editar).
3. Horário de Atendimento
   - Ativar Horário Comercial, Fuso Horário, Horários por Dia (segunda a domingo) e Mensagem Fora do Horário.

Tudo respeita a permissão de edição já usada na página (`canEdit`) e salva no mesmo botão "Salvar" do topo.

## Comportamento no motor (backend)

No `x-julia-engine`, antes de rodar o turno:
- Se "Apenas Campanha" estiver ligado e a mensagem não tiver campanha/CTA nem casar com as frases de início de campanha, o agente não responde.
- Se a mensagem casar com uma frase de "Início da Sessão", a sessão é reiniciada na etapa de recepção.
- Se casar com "Verificar Atendimento Especializado", a sessão vai para a etapa `humano` e o agente para.
- Se o horário comercial estiver ativo e a mensagem chegar fora do expediente, envia a mensagem de fora do horário (uma vez por janela) e não executa o turno.
- Se "Usar Áudio" estiver desligado, a resposta nunca é sintetizada em áudio (comportamento já existente via `voice_enabled`).

## Detalhes técnicos

- Migration: adicionar em `public.xj_agents` a coluna `activation jsonb not null default '{}'` (guarda `session_start`, `only_campaign`, `start_campaign`, `check_specialized`). `business_hours jsonb` já existe e passará a guardar `{ enabled, timezone, schedule, off_message }`, no mesmo formato de `BusinessHoursSchedule`. Sem novas tabelas, sem mudança de RLS/GRANT.
- Frontend: novo componente `src/modules/x-julia/components/XJActivationTab.tsx` reutilizando `MultiPhraseInput` e `BusinessHoursEditor` de `src/pages/agents/components/wizard-steps/`, plus o helper `checkBusinessHours` de `src/lib/businessHoursUtils.ts` (apenas para o preview de status). Aba adicionada em `AgentEditorPage.tsx`, campos incluídos no `form`/`handleSave`.
- Tipos: `activation` e `business_hours` tipados em `src/modules/x-julia/types.ts` e em `supabase/functions/_shared/x-julia/types.ts`.
- Backend: novo helper `supabase/functions/_shared/x-julia/activation.ts` (match de frases + checagem de horário em timezone) usado pelo `x-julia-engine/index.ts` antes de `runXJTurn`; eventos registrados em `xj_session_events` (`kind: "gate"`) para auditoria.
