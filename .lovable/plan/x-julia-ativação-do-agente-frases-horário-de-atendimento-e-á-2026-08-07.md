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
   - Este é o **horário de atuação da Julia**: dentro das faixas configuradas o agente responde; fora delas ele não responde (apenas a mensagem de fora do horário, se preenchida).
   - Ativar Horário de Atuação, Fuso Horário e Mensagem Fora do Horário.
   - **Múltiplas faixas por dia**: cada dia da semana pode ter N intervalos (ex.: seg–sex `00:00–07:59` e `22:00–23:59`; sáb/dom `00:00–23:59`), com botões para adicionar/remover faixa.
   - Atalho "Aplicar a vários dias": define as faixas de uma vez para os dias selecionados (ex.: seg/ter/qua/qui/sex).

Tudo respeita a permissão de edição já usada na página (`canEdit`) e salva no mesmo botão "Salvar" do topo.

## Comportamento no motor (backend)

No `x-julia-engine`, antes de rodar o turno:
- Se "Apenas Campanha" estiver ligado e a mensagem não tiver campanha/CTA nem casar com as frases de início de campanha, o agente não responde.
- Se a mensagem casar com uma frase de "Início da Sessão", a sessão é reiniciada na etapa de recepção.
- Se casar com "Verificar Atendimento Especializado", a sessão vai para a etapa `humano` e o agente para.
- Se o horário de atuação estiver ativo e a mensagem chegar fora de **todas** as faixas do dia, envia a mensagem de fora do horário (uma vez por janela) e não executa o turno.
- Se "Usar Áudio" estiver desligado, a resposta nunca é sintetizada em áudio (comportamento já existente via `voice_enabled`).

## Detalhes técnicos

- Migration: adicionar em `public.xj_agents` a coluna `activation jsonb not null default '{}'` (guarda `session_start`, `only_campaign`, `start_campaign`, `check_specialized`). `business_hours jsonb` já existe e passará a guardar `{ enabled, timezone, off_message, schedule }`, onde `schedule` é `{ monday: { enabled, ranges: [{ start, end }] }, ... }` — múltiplos intervalos por dia. Sem novas tabelas, sem mudança de RLS/GRANT.
- Frontend: novo componente `src/modules/x-julia/components/XJActivationTab.tsx` reutilizando `MultiPhraseInput`, mais um editor próprio `XJBusinessHoursEditor` (o `BusinessHoursEditor` da Julia clássica suporta só um intervalo por dia e não será alterado). Helper novo `src/modules/x-julia/lib/xjBusinessHours.ts` com `isWithinXJHours(business_hours, now)` para o preview de status na UI. Aba adicionada em `AgentEditorPage.tsx`, campos incluídos no `form`/`handleSave`.
- Tipos: `activation` e `business_hours` tipados em `src/modules/x-julia/types.ts` e em `supabase/functions/_shared/x-julia/types.ts`.
- Backend: novo helper `supabase/functions/_shared/x-julia/activation.ts` (match de frases + checagem de faixas por dia no timezone configurado, usando `Intl.DateTimeFormat`) usado pelo `x-julia-engine/index.ts` antes de `runXJTurn`; eventos registrados em `xj_session_events` (`kind: "gate"`) para auditoria.
