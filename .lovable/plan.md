## Objetivo

Reformular o painel lateral esquerdo de `/tickets/:id` em abas (**Detalhes** e **Histórico**) e introduzir badges de SLA ricos (no estilo `/chat`), aplicando a configuração de SLA já existente em "Configurações" do módulo de tickets.

---

## 1. Abas no painel lateral esquerdo

Substituir o `Card` único atual por um `Tabs` com duas abas, mantendo a mesma largura (`lg:col-span-1`).

### Aba "Detalhes"
Contém exatamente o que hoje aparece no card lateral:
- Badges (status, prioridade, SLA — agora rico, ver §3)
- Selects de Status / Prioridade / Departamento / Categoria / Responsável (para agente)
- Bloco "Solicitante" (nome, e-mail, telefone)
- Botão "Abrir conversa" (quando há `contact_id`)
- Bloco CSAT (avaliação ou formulário)

Nenhuma alteração funcional — apenas reembrulhado em `<TabsContent value="detalhes">`.

### Aba "Histórico"
Lista cronológica reversa (mais novo primeiro) de **todos** os eventos do ticket, derivados de `support_ticket_messages` filtrando `kind = 'event'` **mais** entradas sintéticas para mensagens públicas/internas (envio de resposta / nota interna).

Cada item exibe:
- Ícone por tipo de evento (criação, mudança de status, prioridade, departamento, categoria, responsável, resposta enviada, nota interna, CSAT)
- Texto descritivo (já gravado em `body` pelo `logEvent`)
- Autor (`author_name`) e timestamp formatado (`dd/MM/yyyy HH:mm`)

Eventos já registrados hoje pelas mutations: `created`, `status_change`, `updated` (com `event` opcional), `assigned`, `csat`. O `update` para prioridade já passa `event: "Prioridade: …"`. **Acrescentar** chamadas a `logEvent` para mudanças de **departamento** e **categoria** (hoje passam sem `event`) para que apareçam no histórico de forma consistente.

Também serão exibidas, intercaladas pelo `created_at`, as mensagens `public` e `internal` como "Resposta enviada por X" / "Nota interna por X" — derivadas do mesmo array `messages` já carregado em `useTicket`. Sem nova query.

---

## 2. Badges de SLA com nome do responsável nas listas

Sem mudança — a feature já está implementada nas listagens/kanban via badge de responsável. (Não tocar.)

---

## 3. Avaliador de SLA do ticket (estilo `/chat`)

### Diagnóstico atual
- `useTicketMutations.create` já calcula `sla_first_response_due_at` e `sla_resolution_due_at` a partir de `support_settings.sla[priority]` na criação. ✅
- Mutations de `reply` já gravam `first_response_at` na primeira resposta do agente. ✅
- O badge atual é binário (atrasado / no prazo), sem indicar qual SLA está em jogo nem o tempo restante.

### Novo componente `TicketSlaBadge`
Arquivo: `src/pages/tickets/components/TicketSlaBadge.tsx`.

Reaproveita visual/UX do `src/components/chat/SlaBadge.tsx`:
- Estados: `on_track` (verde), `at_risk` (âmbar, quando restam ≤ 25% do prazo), `breached` (vermelho), `unknown`.
- Tipos: **FRT** ("1ª Resposta") quando `first_response_at` ainda é nulo; **TTR** ("Resolução") caso contrário. (Tickets não têm equivalente a NRT do chat.)
- Tooltip com tipo, descrição curta e tempo restante/atrasado (`formatRemaining` — reaproveitar de `useChatSlaConfigs`).
- Variante `compact` para listagem/kanban e padrão para o detalhe.

### Função de avaliação
Adicionar em `src/pages/tickets/hooks/useTickets.ts` (ao lado de `isOverdue`) uma função `evaluateTicketSla(ticket)` que retorna `{ status, slaType, slaTypeLabel, remainingMinutes, targetMinutes }`.

Lógica:
1. Se `status ∈ {resolved, closed}` → `on_track`, label "Concluído".
2. Se `!first_response_at` e `sla_first_response_due_at` existe → calcula restante até o due; classifica em on_track / at_risk / breached. SLA type = FRT.
3. Caso contrário, se `sla_resolution_due_at` existe → calcula restante até o due; classifica idem. SLA type = TTR.
4. Sem due dates → `unknown` (não renderiza badge).

`isOverdue` permanece para retrocompatibilidade (filtro "apenas atrasados").

### Aplicação
- Substituir o `SlaBadge` local em `TicketDetailPage.tsx` pelo novo `TicketSlaBadge`.
- Em `TicketsListTab.tsx` e `TicketsKanban.tsx`: substituir o uso atual de `isOverdue` → badge binário, pelo `TicketSlaBadge` em modo `compact`.

### Validação da configuração
Verificar que `useSupportConfig().settings.sla` carrega corretamente e que `create` está lendo a coluna `sla` de `support_settings` (já está — sem mudança).

---

## Arquivos afetados

```text
src/pages/tickets/TicketDetailPage.tsx        (abas + novo SlaBadge)
src/pages/tickets/components/TicketSlaBadge.tsx   (novo)
src/pages/tickets/components/TicketHistoryTab.tsx (novo)
src/pages/tickets/components/TicketDetailsTab.tsx (novo — refactor do bloco existente)
src/pages/tickets/components/TicketsListTab.tsx   (badge SLA rico)
src/pages/tickets/components/TicketsKanban.tsx    (badge SLA rico)
src/pages/tickets/hooks/useTickets.ts             (evaluateTicketSla + logEvent para depto/categoria)
```

Sem migração de banco. Sem mudança em RLS. Sem mudança em edge functions.