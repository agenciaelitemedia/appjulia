

## Bloco "Filas" no Criar/Editar Agente

### Escopo desta etapa

Adicionar um novo bloco **"Filas"** no ConfigStep do agente com 2 configurações iniciais (mais virão depois):

1. **Total de filas permitidas** (`QUEUE_LIMIT`) — número inteiro, padrão `1`.
2. **Permitir grupos** (`ALLOW_GROUPS`) — switch, padrão `false` (desabilitado).

Esses valores são persistidos no JSON `settings` do agente (tabela externa `agents`) — o ConfigStep já serializa tudo automaticamente, então **não exige migração de schema**.

### Onde aparece (UI)

Novo `Card` no `src/pages/agents/components/wizard-steps/ConfigStep.tsx`, posicionado logo abaixo do bloco "Copiloto Julia IA" (alta visibilidade):

```
┌─ Filas de Atendimento ──────────────────┐
│ [icon Network]                          │
│                                         │
│ Total de filas permitidas    [  1  ]    │
│ Quantas filas este agente pode criar    │
│                                         │
│ ─────────────────────────────────────   │
│                                         │
│ Permitir grupos              [○──]      │
│ Habilita o atendimento de grupos do     │
│ WhatsApp (@g.us) nas filas deste agente │
└─────────────────────────────────────────┘
```

Como o ConfigStep é compartilhado entre `CreateAgentWizard`, `EditAgentPage` e `MyAgentEditPage`, o bloco aparece automaticamente nas 3 telas. No `MyAgentEditPage` (proprietário), respeita o `can_edit_config` já existente.

Adicionar `QUEUE_LIMIT: 1` e `ALLOW_GROUPS: false` ao `DEFAULT_CONFIG` e à `interface ConfigFields`.

### Como reflete na criação/edição de filas (enforcement)

**A. Limite de filas (`QUEUE_LIMIT`)**

1. Frontend (`src/pages/agente/filas/FilasPage.tsx`): novo hook `useAgentQueueLimits()` que carrega via `externalDb` o agente do usuário logado (vinculação por `cod_agent`/`client_id`) e retorna `{ queueLimit, allowGroups }`. O botão "Nova Fila" fica desabilitado com tooltip quando `activeQueues.length >= queueLimit` ("Limite de X filas atingido. Contate seu administrador para aumentar.").
2. Backend (`supabase/functions/queue-management/index.ts`, action `create`): antes do insert, contar filas ativas do `client_id` (`COUNT * FROM queues WHERE client_id = ? AND is_deleted = false`) e buscar `QUEUE_LIMIT` do agente associado via chamada interna a `db-query` (settings JSON do agente do client). Se `count >= limit` → retornar erro `"queue_limit_reached"`. Garante que mesmo bypass de UI seja barrado.

**B. Permitir grupos (`ALLOW_GROUPS`)**

1. Frontend (`QueueFormDialog`/`QueueWizardDialog`): novo campo informativo somente-leitura "Aceita grupos" mostrando ✓/✗ baseado no `ALLOW_GROUPS` do agente (não editável aqui — config vive no agente, não na fila).
2. Backend (`supabase/functions/uazapi-chat-webhook/index.ts`): após detectar `isGroup` (linha 299) e antes de processar, resolver o agente da fila (via `queue_id` → `queue_agent_links.cod_agent` → `agents.settings.ALLOW_GROUPS` via `db-query`). Se `isGroup === true && ALLOW_GROUPS !== true` → `skipped.group++; continue;` (já existe o contador). Cache de 60s em memória da edge para evitar lookup por mensagem.

### Edge function helper

Adicionar uma action utilitária em `db-query` (ou criar `get-agent-settings` curta) que recebe `client_id` e/ou `cod_agent` e retorna `{ queue_limit, allow_groups }` parseados do JSON `settings`. Usada por `queue-management` (limite) e `uazapi-chat-webhook` (grupos).

### Arquivos alterados

- `src/pages/agents/components/wizard-steps/ConfigStep.tsx` — adicionar bloco "Filas" (Card com Input numérico e Switch); incluir `QUEUE_LIMIT` (1) e `ALLOW_GROUPS` (false) em `ConfigFields` e `DEFAULT_CONFIG`.
- `src/pages/agente/filas/hooks/useAgentQueueLimits.ts` *(novo)* — busca limites do agente do usuário logado.
- `src/pages/agente/filas/FilasPage.tsx` — desabilitar botão "Nova Fila" quando limite atingido + tooltip; mostrar "X / Y filas usadas" no header.
- `src/pages/agente/filas/components/QueueFormDialog.tsx` — campo informativo "Aceita grupos" (read-only) baseado no agente.
- `supabase/functions/queue-management/index.ts` — gate na action `create`: contar filas + ler `QUEUE_LIMIT` via `db-query`; bloquear com erro claro se exceder.
- `supabase/functions/uazapi-chat-webhook/index.ts` — após `isGroup`, resolver `ALLOW_GROUPS` do agente da fila (com cache); pular ingestão se desabilitado.
- `supabase/functions/db-query/index.ts` — nova action `get_agent_queue_settings` que retorna `{ queue_limit, allow_groups }` do JSON `settings`.

### Resultado esperado

- Admin (criar/editar agente) e proprietário (Meus Agentes → Editar) configuram limite e permissão de grupos no novo bloco "Filas" do ConfigStep.
- Tela de Filas respeita o limite (UI + backend) — não dá pra criar a 2ª fila se o limite for 1.
- Mensagens de grupo do WhatsApp são silenciosamente ignoradas pelo webhook quando `ALLOW_GROUPS = false` (padrão), eliminando ruído de grupos não desejados.

