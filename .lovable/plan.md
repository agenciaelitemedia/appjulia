# Sessões X-Julia — novo menu de gestão

Novo item de menu **Sessões** (`/x-julia/sessoes`), separado de "Atendimentos", focado na gestão técnica das sessões do agente.

## O que a tela mostra

Lista de todas as sessões do escritório selecionado (respeita o seletor de escritório atual), com:

- Contato (nome + telefone), caso identificado, canal/origem e campanha.
- Etapa atual, qualificação, nº de turnos.
- Estado do agente: **Ativa** ou **Inativa** (com o motivo da pausa).
- Última mensagem do lead / última resposta do agente.
- Filtros: busca, etapa, qualificação, somente ativas / somente inativas.
- Seleção múltipla para ações em massa (pausar, reativar, excluir).

## Ações por sessão

- **Pausar** / **Reativar** o agente na conversa (reativar limpa o motivo da pausa).
- **Mudar etapa** — ao escolher a nova etapa, o agente age na hora (ver abaixo).
- **Editar** campos-chave: qualificação (+ motivo), tipo de caso, caso vinculado da biblioteca e os dados coletados (slots) — adicionar, editar e remover chave/valor.
- **Excluir sessão** (dupla confirmação, padrão do sistema): apaga a sessão, seus eventos e os followups. O lead volta ao estado "nunca atendido"; as mensagens do chat não são tocadas.
- **Abrir detalhes** (página atual de atendimento) e **Abrir chat**.

## Resposta à sua pergunta: mudar etapa faz o agente seguir?

Hoje **não** — a etapa nova só passava a valer na próxima mensagem do lead. Isso muda: ao mover a sessão para uma etapa (ex.: Negociação), o agente executa um turno imediatamente com a instrução daquela etapa e envia a mensagem ao lead conduzindo a negociação, usando o prompt da etapa, os dados já coletados e todo o histórico da conversa. Se a sessão estiver pausada, mudar a etapa com ação imediata a reativa. A intervenção fica registrada na trilha de eventos.

Regras de segurança da ação imediata:
- Só dispara se houver fila válida com credenciais e telefone do lead.
- Respeita o horário de atendimento do agente (fora dele, a etapa é aplicada sem envio).
- Etapas `humano` e `encerrado` não disparam mensagem — apenas mudam o estado.

## Detalhes técnicos

- Menu: novo item `x_julia_sessions_manage` em `src/modules/x-julia/module.ts` (+ rota `sessoesPattern`), rota protegida em `src/App.tsx` dentro de `XJScopeProvider`, e registro automático no módulo/permissões via `useEnsureXJuliaModule`.
- Página nova `src/modules/x-julia/pages/SessionsManagePage.tsx` + dialogs de edição; reaproveita `XJLayout`, `XJStageBadge`, `XJQualificationBadge`.
- Hook novo `useXJSessionAdmin.ts` com mutations: `pause`, `resume`, `updateFields`, `updateSlots`, `remove` (delete em `xj_session_events` → `xj_followups` → `xj_sessions`) e `advanceStage` (grava etapa + invoca o motor).
- Motor: nova ação `advance_stage` em `supabase/functions/x-julia-engine/index.ts` — carrega sessão/agente/fila, aplica a etapa, monta um `inbound` sintético de instrução interna (não entra no histórico como mensagem do lead) e chama `runXJTurn`, registrando `stage_forced` em `xj_session_events`.
- Sem alterações de schema.