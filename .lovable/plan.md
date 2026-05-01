# Regra unificada de reabertura de conversas

## Regra de negócio (final)

Ao chegar uma **nova mensagem inbound** (`fromMe = false`) de um contato:

1. **Existe conversa ativa** (`pending` ou `open`) para o mesmo contato + fila + canal → anexa a mensagem nela (comportamento atual mantido).
2. **Existe conversa `resolved`** (mais recente) → **reabre essa mesma conversa**:
   - `status` volta para `open`
   - `resolved_at` zerado
   - **`assigned_to` permanece** (mesmo agente que resolveu continua dono)
   - registra evento `reopened` no histórico
3. **Não há ativa nem resolved** (só existem `closed`, ou nenhuma) → **cria uma nova conversa**:
   - `status = 'pending'`
   - `assigned_to = null` (sem dono — vai para a fila de pendentes)
   - registra evento `opened`

Mensagens **outbound** (`fromMe = true`, ecos do operador/IA) continuam apenas se anexando à conversa ativa, sem nunca reabrir uma `resolved` nem criar nova após `closed` (evita ruído quando agente envia mensagem fora do ticket).

## Estado atual no código

- `uazapi-chat-webhook` (WhatsApp UaZapi): **já tem reabertura para `resolved`** (linhas 1140-1196), mas precisa de pequenos ajustes de robustez. Closed já cai no fluxo correto (cria nova sem `assigned_to`).
- `meta-webhook` (WhatsApp WABA, linhas 222-257): **não busca `resolved`** — sempre cria nova conversa quando não há ativa. Precisa adicionar a etapa de reabertura.
- `instagram-webhook` (linhas 121-145): mesma falha do WABA + não filtra por `queue_id`/`channel`. Precisa adicionar reabertura.
- `webchat-api`: verificar e alinhar se aplicável.

## Mudanças

### 1. `supabase/functions/uazapi-chat-webhook/index.ts` (ajustes)
- Garantir que o update de reabertura **não toca em `assigned_to`** (já é o caso — confirmar).
- Atualizar `updated_at` explicitamente no reopen.
- Já está correto no essencial; apenas pequenos polimentos.

### 2. `supabase/functions/meta-webhook/index.ts`
Inserir, entre o lookup de `openConv` e o `insert` de nova conversa, uma busca por `status = 'resolved'`:
- Se existe → `update { status: 'open', resolved_at: null }` e usar esse `id`.
- Senão → segue criando nova `pending` (sem `assigned_to`).
- Apenas para mensagens inbound (não para ecos do `messages` outbound do próprio agente via API).
- Inserir registro em `chat_conversation_history` (`reopened` ou `opened`).

### 3. `supabase/functions/instagram-webhook/index.ts`
- Adicionar filtro por `client_id`, `channel = 'instagram'` e `queue_id` na busca de conversa ativa.
- Adicionar etapa de reabertura de `resolved` (mesmo padrão do WABA).
- Nova conversa criada sem `assigned_to` (remover `cod_agent` do insert se ele estiver atuando como dono — manter apenas para roteamento de fila).

### 4. `supabase/functions/webchat-api/index.ts`
- Verificar lógica de associação a conversa e aplicar o mesmo padrão (resolved → reopen, closed/none → nova sem dono).

## Detalhes técnicos

- **Diferença `resolved` vs `closed`**: o enum `ConversationStatus` já distingue (`'pending' | 'open' | 'closed' | 'resolved'`). `resolved` = "encerramento leve" (cliente pode voltar e a conversa volta atribuída ao mesmo dono). `closed` = "encerramento definitivo" (próximo contato é um ticket novo, vai para a fila sem dono).
- **`assigned_to` preservado**: é suficiente **não incluí-lo no `update`** do reopen — o valor anterior permanece intacto no banco.
- **Idempotência**: o reopen só ocorre quando `status = 'resolved'`. Se já estiver `open`, cai no caminho 1 (anexa).
- **Histórico**: cada reopen e cada nova abertura geram entrada em `chat_conversation_history` para rastreabilidade.
- **Echos (`fromMe=true`)**: anexam à conversa ativa se houver; não disparam reopen nem criação.

## Arquivos a editar

- `supabase/functions/uazapi-chat-webhook/index.ts` (revisão pequena)
- `supabase/functions/meta-webhook/index.ts`
- `supabase/functions/instagram-webhook/index.ts`
- `supabase/functions/webchat-api/index.ts` (se aplicável após revisão)

## Memória

Salvar em `mem://features/chat/conversation-reopen-rules.md`:
- `resolved` reabre mesma conversa, mantém `assigned_to`.
- `closed` força nova conversa sem `assigned_to`.
- Reopen só em mensagens inbound; outbound apenas anexa.
