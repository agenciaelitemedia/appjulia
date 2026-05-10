## Por que conversas com Julia ativa caem no filtro "Humano" hoje

A classificação está em `src/components/chat/ChatList.tsx` (`getContactMode` / `getConversationMode`, linhas ~448–471). A regra atual é:

```
se a fila NÃO tem agente vinculado            -> humano
se a sessão (phone + codAgent) NÃO está active=true -> humano  (inclui false, undefined e "não encontrada")
caso contrário                                -> julia
```

E os pares `(whatsappNumber, codAgent)` consultados em `sessionActiveMap` são montados em `sessionPairs` (linhas ~351–367) usando o `cod_agent` que vem do **vínculo da fila** (`queueAgentMap`), com o telefone do contato apenas com dígitos.

Causas reais por que uma conversa "com Julia ativa" aparece como Humano:

1. **Sessão não existe na tabela `agent_sessions` para aquele par `(phone, codAgent)`**. Nesse caso `sessionActiveMap.get(key)` retorna `undefined`, e a regra atual trata `undefined` como humano. Isso acontece sempre que:
   - a sessão ainda não foi criada (lead novo, primeira mensagem ainda não processada);
   - a sessão foi criada para um `cod_agent` diferente do que está vinculado hoje na fila (ex.: a fila foi reapontada para outro agente, mas a sessão antiga continua ativa no agente anterior);
   - o telefone gravado em `agent_sessions.whatsapp_number` está com máscara diferente do `chat_contacts.phone` após remover não-dígitos (ex.: com/sem `55`, com/sem 9º dígito, sufixo de grupo).

2. **A fila da conversa não tem agente vinculado** (`queueAgentMap` sem `hasAgent`). Toda conversa dessa fila vira humano por definição, mesmo que exista uma sessão Julia ativa em outra dimensão.

3. **A conversa não tem `queue_id`** (campo nulo em `chat_conversations`). Sem fila, não há `codAgent` para consultar a sessão → cai em humano.

4. **`sessionActiveMap` ainda está carregando** (`undefined` porque a query batch não voltou). Durante esse intervalo todos os contatos parecem humano. Some quando a query volta.

5. **Sessão paused (`active=false`)** — esse é o único caso que é correto classificar como humano (regra de Human Override já documentada).

Os itens 1 a 4 são ruído: a Julia *está* ativa, mas a UI não consegue confirmar e por isso assume humano.

## O que mudar

Tudo no `src/components/chat/ChatList.tsx`. Sem mudanças de schema/backend.

1. **Distinguir 3 estados** em vez de 2 no resultado de `getContactMode`/`getConversationMode`:
   - `julia` — fila com agente, sessão `active === true`.
   - `human` — fila com agente, sessão `active === false` (override humano confirmado).
   - `unknown` — qualquer outro caso (sem fila, sem vínculo, sem sessão, ainda carregando, mismatch de phone/cod_agent).

2. **Filtro de modo passa a tratar `unknown` separadamente:**
   - `modeFilter === 'julia'` → mantém só `julia`.
   - `modeFilter === 'human'` → mantém só `human` (sessão paused). **Não inclui `unknown`** — é a correção do bug relatado.
   - `modeFilter === 'all'` → mantém todos.
   - Opcional (a confirmar com o usuário): adicionar um 4º botão "Sem definição" para visualizar `unknown`, ou ocultá-los das duas abas filtradas mas continuar exibindo em "Todos".

3. **Tornar o lookup de sessão mais tolerante** para reduzir o universo `unknown`:
   - Em `sessionPairs`, além do telefone "limpo", indexar variantes E.164 (com e sem `55`, com e sem 9º dígito) usando `phoneVariants` (já existe em `src/lib/phoneVariants.ts`).
   - Em `useAgentSessionStatusesBatch`, normalizar a chave do `Map` por todas as variantes do `whatsapp_number` retornadas, para que `getSessionActive(phone, codAgent)` ache a sessão mesmo quando o número estiver gravado em outro formato.

4. **Esperar o batch carregar antes de classificar.** Enquanto `sessionActiveMap === undefined` (primeira carga), retornar `unknown` e suprimir do filtro `human` — exatamente como acima. O efeito visual é que conversas só "viram" julia/humano depois do retorno da query, em vez de piscarem em humano.

## Detalhes técnicos

- Locais a alterar:
  - `getContactMode` e `getConversationMode` em `ChatList.tsx` — passam a retornar `'julia' | 'human' | 'unknown'`.
  - Filtros que usam `modeFilter` (linhas ~512, 671–672, 783–784, 914–915) — comparar com igualdade estrita: `unknown` nunca casa com `julia` nem `human`.
  - `sessionPairs` (linhas ~351–367) — gerar todas as variantes do telefone via `phoneVariants`.
  - `useAgentSessionStatusesBatch` (`src/hooks/useAgentSessionStatusesBatch.ts`) — popular o `Map` com todas as variantes do número retornado pelo banco.

- Risco controlado: a mudança não afeta o badge de status individual da conversa (Bot icon), apenas a contagem/filtro de modo na lista.

## Fora de escopo

- Backfill/correção de `agent_sessions` históricas com `cod_agent` divergente da fila atual.
- Mudança no comportamento de Human Override (`active=false` ao receber `fromMe`) — segue como está.
- Servidor-side filter por modo na query da lista — continua client-side.

## Pergunta para confirmar antes de implementar

O comportamento desejado para conversas em estado `unknown` (Julia provavelmente ativa mas sem sessão confirmada) é:

- (a) **Não aparecer** nem no filtro Julia nem no Humano — só em "Todos". (recomendado)
- (b) Tratar como **Julia por padrão** (oposto do bug atual).
- (c) Adicionar um **4º botão "Sem definição"** para inspecioná-las.
