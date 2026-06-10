# Protocolo de Ticket por Máscara

Criar um sistema flexível de geração de números de protocolo para tickets, configurável por máscara em Configurações do módulo de Tickets.

## 1. Máscara — Tokens suportados

| Token | Significado |
|-------|-------------|
| `AAAA` | Ano (4 dígitos) |
| `AA` | Ano (2 dígitos) |
| `MM` | Mês (2 dígitos) |
| `DD` | Dia (2 dígitos) |
| `HH` | Hora (2 dígitos) |
| `II` | Minuto (2 dígitos) (evita conflito com `MM` mês) |
| `SSSSSS` | Sequencial do mês (largura = nº de S) |
| `NNNNNN` | Sequencial do dia (largura = nº de N) |

Qualquer outro caractere é literal (ex.: `220022`, `-`, `/`).

Máscara padrão sugerida: `AAAAMMDDNNNNNN`
Exemplo ANS: `220022AAAAMMDDNNNNNN` → `22002220260906000001`

## 2. Backend (uma migração)

### 2.1 Coluna no ticket
```sql
ALTER TABLE public.support_tickets
  ADD COLUMN protocol text;
CREATE UNIQUE INDEX idx_support_tickets_protocol
  ON public.support_tickets(protocol) WHERE protocol IS NOT NULL;
```

### 2.2 Configuração da máscara
Adicionar em `public.support_settings`:
```sql
ALTER TABLE public.support_settings
  ADD COLUMN protocol_mask text NOT NULL DEFAULT 'AAAAMMDDNNNNNN';
```

### 2.3 Contadores
```sql
CREATE TABLE public.support_protocol_counters (
  scope text PRIMARY KEY,   -- 'M:2026-06' ou 'D:2026-06-10'
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_protocol_counters TO authenticated;
GRANT ALL ON public.support_protocol_counters TO service_role;
ALTER TABLE public.support_protocol_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read counters" ON public.support_protocol_counters FOR SELECT TO authenticated USING (true);
```

### 2.4 Função render
`public.generate_ticket_protocol(mask text) RETURNS text` — `SECURITY DEFINER`.
- Lê hora atual em `America/Sao_Paulo`.
- Detecta tokens via regex `(AAAA|AA|MM|DD|HH|II|S+|N+)`.
- Para `S+`: `INSERT ... ON CONFLICT (scope) DO UPDATE SET last_value = last_value + 1 RETURNING last_value` com `scope = 'M:YYYY-MM'`, lpad pelo nº de S.
- Para `N+`: idem com `scope = 'D:YYYY-MM-DD'`.
- Retorna a string final.

### 2.5 Trigger BEFORE INSERT em `support_tickets`
```sql
CREATE FUNCTION set_support_ticket_protocol() ...
  IF NEW.protocol IS NULL THEN
    SELECT protocol_mask INTO v_mask FROM public.support_settings WHERE id = 'global';
    NEW.protocol := public.generate_ticket_protocol(COALESCE(v_mask,'AAAAMMDDNNNNNN'));
  END IF;
```
Mantém o trigger existente `set_support_ticket_number` (não conflita).

### 2.6 Propagar para `chat_conversations.active_ticket_protocol`
```sql
ALTER TABLE public.chat_conversations ADD COLUMN active_ticket_protocol text;
```
Atualizar `sync_conversation_active_ticket()` para gravar `active_ticket_protocol = NEW.protocol` junto com `active_ticket_id/number` (e limpar quando fechar).

## 3. Frontend

### 3.1 Tipos (`src/pages/tickets/types.ts`)
- `SupportTicket.protocol: string | null`
- `SupportSettings.protocol_mask: string`
- `TicketConversationLink.protocol: string | null`

### 3.2 Configurações (`SupportSettingsTab.tsx`)
Novo Card "Protocolo":
- Input `protocol_mask`.
- Box de ajuda listando tokens.
- Preview ao vivo (renderiza no client com data atual e contadores fictícios `000001`).
- Salva via `saveSettings` (incluir `protocol_mask` no payload de `useSupportConfigMutations.saveSettings`).

### 3.3 Lista de conversas (`ChatContactItem.tsx`)
Onde já renderiza `#{ticketLink.number}`, adicionar logo após o badge "TICKET":
```
TICKET  #PROTOCOLO
```
Usar `ticketLink.protocol` quando presente; fallback para `#{number}`.

### 3.4 Hook `useTicketLinkedConversations.ts`
Incluir `protocol` no `select` e no `Map`.

### 3.5 Detalhes do ticket
- `TicketDetailPage.tsx` e `ChatTicketDetailSidePanel.tsx`: exibir `Protocolo: {ticket.protocol}` no cabeçalho, ao lado de `#{number}`.
- Lista de tickets (`TicketsPage` lista/kanban): mostrar protocolo como subtítulo do card/linha.

## 4. Hooks afetados
- `useTickets` (`useSupportConfig`, `useSupportConfigMutations`): incluir `protocol_mask` em load/save de `support_settings`.
- Queries de listagem de tickets: incluir `protocol` no `select`.

## 5. Edge cases
- Máscara vazia → fallback `AAAAMMDDNNNNNN`.
- Tokens ambíguos: `MM` = mês, `II` = minuto (documentado na UI).
- Concorrência: `INSERT ... ON CONFLICT DO UPDATE RETURNING` garante atomicidade do sequencial.
- Reset: como o `scope` muda com mês/dia, o contador reinicia naturalmente.
- Backfill: tickets antigos ficam com `protocol = NULL` (UI mostra `#{number}` como fallback).

## 6. Entregáveis
1. 1 migração SQL (coluna, settings, contadores, função, trigger, sync update).
2. Edição de `support_settings` UI (novo Card).
3. Atualização do hook `useTicketLinkedConversations` + tipo.
4. Render do protocolo em `ChatContactItem`, `TicketDetailPage`, `ChatTicketDetailSidePanel`, listas de ticket.
