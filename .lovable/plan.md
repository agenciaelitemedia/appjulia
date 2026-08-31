# MCP: localizar conversa por protocolo, telefone ou contato

## O que aconteceu com o 5571996043107

A conversa existe e está acessível: contato "Jennifer Pereira Santos", telefone `5571996043107`, protocolo `#2026-059468`, status aberto, no escritório 300, sem pausa (snooze). Ou seja, não é falta de dado nem bloqueio de escopo.

A causa é da interface das ferramentas:

1. O campo de busca da tool de listagem diz, na própria descrição, que aceita apenas "Nome ou telefone do lead". Por isso a agente concluiu que protocolo não era pesquisável e partiu para varrer 1.200 conversas por paginação, em vez de fazer uma busca direta. Na prática a consulta unificada do chat **já** filtra por protocolo (além de nome, telefone e nome completo).
2. Não existe uma ferramenta objetiva de "localizar atendimento" que receba protocolo/telefone e devolva o `conversation_id`. Hoje o único caminho é listar e paginar.
3. A listagem esconde conversas pausadas (snooze) de forma fixa, sem opção de incluir. Não afetou este caso, mas é um ponto cego real em buscas por identificador.
4. Buscas por telefone dependem do formato digitado: um número com/sem o 9º dígito, ou com máscara, pode não casar com o valor armazenado.

## O que será feito

### 1. Nova tool `julia_chat_localizar`
Recebe `protocolo`, `telefone` ou `nome` (pelo menos um) e devolve os atendimentos correspondentes com `conversation_id`, contato, fila, status, responsável, última mensagem e protocolo — sempre no escopo do escritório do token.

- Protocolo é normalizado (aceita `#2026-059468`, `2026-059468`, `2026059468`).
- Telefone é normalizado e pesquisado em todas as variantes brasileiras (com e sem o 9º dígito), reaproveitando o normalizador já existente das Edge Functions.
- Inclui conversas pausadas e de qualquer status por padrão, porque a intenção é encontrar um registro específico.
- Retorna também os outros atendimentos do mesmo contato, quando houver, para a IA escolher com segurança.

### 2. Ajustes na listagem existente
- Corrigir a descrição de `busca` para deixar explícito que aceita nome, telefone **e protocolo**.
- Adicionar `incluir_pausados` (padrão `false`, mantendo o comportamento atual) e forçá-lo para `true` quando a busca for por protocolo/telefone.
- Deixar a mensagem de fim de lista mais clara sobre cobertura, indicando quando o filtro devolveu a página final.

### 3. Documentação e catálogo
Atualizar `docs/MCP_julia.md` e o catálogo de ferramentas em `/mvp-copiloto` com a nova tool e o comportamento de busca, para que o texto que a agente lê descreva as capacidades corretas.

## Detalhes técnicos
- Arquivos: `supabase/functions/_shared/copiloto/tools/chat.ts`, `supabase/functions/_shared/copiloto/tools/index.ts` (registro), `supabase/functions/_shared/phone-normalize.ts` (reuso), `docs/MCP_julia.md`, `src/modules/mvp-copiloto/components/ToolCatalogCard.tsx`.
- `julia_chat_localizar` consulta direto `chat_conversations` + `chat_contacts` filtrando por `client_id` do token, com limite de 20 resultados; não altera a RPC `chat_list_feed`.
- Envelope padrão `{ json, text }` com `requestId`, versão da tool, timezone e paginação, igual às demais.
- Somente leitura; escopo `julia:read`/`leads:read`. Requer redeploy de `copiloto-mcp`.

## Validação
1. `julia_chat_localizar` com `protocolo: "#2026-059468"` deve devolver a conversa da Jennifer com o `conversation_id`.
2. Mesma tool com `telefone: "71996043107"`, `"5571996043107"` e `"(71) 99604-3107"` deve devolver o mesmo resultado.
3. `julia_chat_listar_conversas` com `busca: "2026-059468"` deve devolver 1 linha.
4. Ler o histórico pelo `conversation_id` retornado e confirmar as mensagens.
5. Conferir que protocolo de outro escritório continua não retornando nada.
