# MCP: por que o 5571996043107 "não foi encontrado" e como deixar isso explícito

## Diagnóstico confirmado nos dados

A busca foi feita corretamente pelo número. A auditoria do MCP (`cop_tool_calls`, 31/08 02:30–02:35 BRT) mostra as chamadas reais:

- `busca: "5571996043107"` → 0 resultados
- `busca: "557196043107"` → 0 resultados
- `busca: "#2026-059468"` e `"2026-059468"` → 0 resultados
- em seguida, 6 páginas de 200 sem filtro (offsets 0 a 1000)

O motivo dos zeros **não é a busca**: todas essas chamadas foram feitas com um token cujo escritório é o `client_id 294`. A conversa da Jennifer Pereira Santos, telefone `5571996043107`, protocolo `#2026-059468`, pertence ao `client_id 300` (existe também uma outra, no 275). Rodando a mesma consulta unificada do chat com o escritório 300, tanto o telefone quanto o protocolo retornam exatamente essa conversa — ou seja, a busca por telefone e por protocolo funciona.

Conclusão: o MCP se comportou de forma correta e isolada por escritório. O que falhou foi a **legibilidade**: a resposta "Nenhuma conversa encontrada com esses filtros" não diz em qual escritório a busca ocorreu, então a agente concluiu que era limitação de cobertura/paginação e varreu 1.200 registros à toa.

## O que será feito

### 1. Deixar o escopo explícito em toda resposta do MCP
Incluir no texto e no JSON o escritório efetivo da sessão (id e nome do escritório resolvidos pelo token). Assim, um zero passa a ser lido como "não existe **neste** escritório", e não como "o MCP não alcançou".

### 2. Resposta objetiva quando a busca é por identificador
Quando `busca` (ou a nova tool de localizar) parecer telefone ou protocolo e o resultado for vazio, responder de forma conclusiva: nenhum atendimento com esse identificador existe no escritório da sessão, sem sugerir paginação. Hoje o texto genérico induz à varredura.

### 3. Nova tool `julia_chat_localizar`
Recebe `protocolo`, `telefone` ou `nome` e devolve o `conversation_id` direto, com contato, fila, status, responsável e última mensagem.

- Protocolo normalizado (aceita `#2026-059468`, `2026-059468`, `2026059468`).
- Telefone normalizado e pesquisado em todas as variantes brasileiras (com e sem o 9º dígito), reaproveitando `supabase/functions/_shared/phone-normalize.ts` — hoje uma busca com máscara (`(71) 99604-3107`) não casa com o valor armazenado.
- Ignora o filtro de pausa (snooze), que hoje é fixo em "esconder", para que a busca por identificador nunca tenha ponto cego.
- Sempre limitada ao escritório do token.

### 4. Descrições e documentação
- Corrigir a descrição de `busca` para "nome, telefone **ou protocolo**" (a consulta já filtra protocolo; a descrição atual afirma o contrário e foi o que levou a agente a descartar essa via).
- Atualizar `docs/MCP_julia.md` e o catálogo em `/mvp-copiloto`.

### 5. Verificação da conexão do OpenClaw
Se a intenção era consultar o escritório 300, a autorização OAuth em uso está vinculada a um usuário do escritório 294. Nesse caso é preciso refazer a conexão do conector com um usuário do escritório correto — nenhuma mudança de código resolve isso, e é por isso que o escopo passa a ser exibido na resposta.

## Detalhes técnicos
- Arquivos: `supabase/functions/_shared/copiloto/tools/chat.ts`, o registro de tools em `_shared/copiloto/tools/index.ts`, o montador de envelope (`ok`/`coverage`) para carregar o escopo, `docs/MCP_julia.md`, `src/modules/mvp-copiloto/components/ToolCatalogCard.tsx`.
- `julia_chat_localizar` consulta `chat_conversations` + `chat_contacts` filtrando por `client_id` do token, limite 20; não altera a RPC `chat_list_feed`.
- Envelope padrão `{ json, text }` com `requestId`, versão, timezone e paginação. Somente leitura, escopo `julia:read`/`leads:read`. Requer redeploy de `copiloto-mcp`.

## Validação
1. Com token do escritório 300: `julia_chat_localizar` com `protocolo: "#2026-059468"` e com `telefone: "(71) 99604-3107"` deve devolver o mesmo `conversation_id`.
2. Com token do escritório 294: a mesma consulta deve responder claramente que o identificador não existe **naquele** escritório, citando o escopo, sem sugerir paginação.
3. `julia_chat_listar_conversas` com `busca: "2026-059468"` no escritório 300 deve devolver 1 linha.
4. Ler o histórico pelo `conversation_id` retornado e conferir as mensagens.
