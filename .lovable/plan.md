# Corrigir falso "Julia inativa" por divergência do 9º dígito

## Causa raiz

No `/chat`, o telefone do contato é mantido na forma canônica BR de 13 dígitos (com o 9º dígito), via `normalizeBrPhone`. Já a tabela `sessions` do CRM da Júlia armazena o `whatsapp_number` conforme o WhatsApp entrega: para DDDs em que o WhatsApp omite o 9 (ex.: muitos DDDs ≥ 30), fica com 12 dígitos.

Hoje o lookup do batch de status de sessão (`useAgentSessionStatusesBatch` + edge `get_session_statuses_batch`) compara `whatsapp_number` por igualdade exata (sem variantes). Resultado:

- ChatList monta a chave do Map como `${phone13digits}:${codAgent}`.
- A edge devolve `whatsapp_number=12digits` (sem o 9), virando uma chave diferente no Map.
- `getSessionActive` retorna `undefined` → a conversa é classificada como "humano" mesmo com a Júlia ativa.

A versão single (`get_session_status`) já trata variantes; só a `batch` e o mapeamento de retorno não. Os helpers `getBrPhoneVariants` (`src/lib/phoneVariants.ts`) e `brPhoneVariants` (`src/lib/phoneNormalize.ts` e `supabase/functions/_shared/phone-normalize.ts`) já existem para isso.

## O que será alterado

### 1) Edge function `supabase/functions/db-query/index.ts` — `case 'get_session_statuses_batch'`

- Para cada par `{ whatsappNumber, codAgent }`, expandir `whatsappNumber` em todas as variantes BR usando `brPhoneVariants` (importado de `_shared/phone-normalize.ts`).
- Achar a união de variantes para usar no `WHERE s.whatsapp_number::text = ANY($1)`.
- Manter o filtro por `cod_agent = ANY($2)` como hoje.
- Continuar retornando `whatsapp_number` (forma exata como está no banco) e `cod_agent`/`active`.

### 2) Hook `src/hooks/useAgentSessionStatusesBatch.ts`

Ao montar o `Map<string, boolean>`:

- Para cada linha retornada, calcular todas as variantes do `whatsapp_number` via `getBrPhoneVariants`.
- Inserir uma entrada no Map para cada variante (`${variant}:${cod_agent} → active`), de forma que consumidores que usem qualquer forma (12 ou 13 dígitos) acertem o lookup.
- Continuar retornando o mesmo formato de Map (sem alterar a API do hook) — apenas as chaves ficam mais tolerantes.

### 3) (Defensivo) `ChatList.tsx` `getSessionActive`

- Antes de consultar o Map, normalizar o telefone via `normalizeBrPhone` (em vez de só `replace(/\D/g, '')`), garantindo a forma canônica. Como o Map já passa a conter ambas variantes, isso é redundante mas reforça a robustez para futuras chamadas.

## Não muda

- UI, layout, abas, filtros, paginação.
- API pública dos hooks/edge: mesmo formato de entrada/saída.
- Schema do banco.

## Validação

- Abrir `/chat`, alternar Modo "Humano". Conversas em que a Júlia está ativa (ex.: DDDs sem 9º dígito armazenado no `sessions`) deixam de aparecer aí.
- Conferir contadores por aba: a contagem de "humano" deve cair e a de "julia" subir nos casos afetados.
- Spot-check em `useAgentSessionStatus` (single) — já tolerante, não regrede.
