# MCP: listagem de conversas via query unificada + histórico com links de mídia

Objetivo: as tools de chat do conector MCP (usadas pelo agente no OpenClaw) passarem a devolver a mesma riqueza de dados da lista do chat atual, e o histórico da conversa trazer links de arquivos (imagem, áudio, vídeo, documento) para a IA conseguir ler o conteúdo.

## Situação atual (verificada no código)

- `julia_chat_listar_conversas` (`supabase/functions/_shared/copiloto/tools/chat.ts`) monta a lista com um `select` manual em `chat_conversations` + um segundo `select` em `chat_contacts`. Não traz fila, etiquetas, SLA, ticket, CRM, não lidos, etapa da Júlia nem campanha.
- A lista real do chat usa uma única chamada: `julia-chat-list-feed` → RPC `chat_list_feed` (existe no banco, aceita `p_client_id`, filas, status, aba, responsáveis, busca, período, etiquetas, prioridade, ticket, CRM, SLA, ordenação, limite/offset, esconder adiados).
- `julia_chat_ler_mensagens` usa `buildLeadContext` (`_shared/copiloto/context.ts`), que hoje só cita o **nome** do arquivo e ainda avisa "os arquivos não foram enviados".
- Mídia: o bucket `chat-media` é público e a função `chat-media-download` materializa a mídia (UaZapi `.enc` e `waba_media:<id>`) nesse bucket, gravando `media_url` público na mensagem. Ou seja, existe caminho pronto para gerar link legível.

## Mudança 1 — listagem pela query unificada

Reescrever `julia_chat_listar_conversas` para chamar a RPC `chat_list_feed` com o `client_id` do token (nunca do argumento), repassando filtros equivalentes:

- `status` (all/pending/open/resolved/closed), `tab` (individual/groups), `queue_ids`, responsáveis (`owners`) e `unassigned`, `busca`, período (`from`/`to`), `tag_ids`, `priority`, `has_ticket`, `has_crm_builder`, `sla_status`, `sort`, `limite` (máx. 200) e `offset`.

Cada linha passa a ser formatada com os campos que o feed já entrega: nome/telefone/canal, fila, status, prioridade, protocolo, responsável, não lidos, última mensagem (data + prévia), SLA (tipo, situação e minutos restantes), etiquetas, ticket vinculado, board/pipeline do CRM Builder, etapa do CRM da Júlia, sessão da Júlia ativa ou não, campanha de origem, adiado até, além de `conversation_id` e `contato_id`.

No fim da resposta, incluir os contadores do feed (total, pendentes, abertos, resolvidos, fechados, não lidos, SLA estourado/em risco) e se há mais páginas.

Efeito colateral positivo: as regras de escopo, deduplicação por contato e ordenação passam a ser exatamente as do chat, sem lógica duplicada.

## Mudança 2 — histórico no padrão do chat, com links de arquivo

No módulo de chat do MCP:

1. Passar a selecionar também os campos de mídia da mensagem (`media_url`, `mime`/`metadata.mimetype`, `storage_path` em `metadata`, `channel_type`, `message_id`) além dos atuais.
2. Antes de montar o texto, para cada mensagem de mídia sem link utilizável (vazio, `waba_media:...`, `.enc`, `mmg.whatsapp.net`), chamar `chat-media-download` para materializar o arquivo no bucket público e obter a URL. Limite por chamada (ex.: 30 arquivos por leitura) e execução em pequenos lotes, para não estourar tempo; o que não resolver aparece como "link indisponível".
3. Ampliar o compilador de contexto para que cada linha de mídia fique assim:
   - `[data] [CLIENTE]: (imagem: contrato.jpg) https://.../chat-media/...`
   - áudio: mantém a transcrição quando existir **e** acrescenta o link do áudio.
   - documento: nome + link.
4. Trocar o bloco final por `=== ARQUIVOS DA CONVERSA ===` com numeração, tipo, nome e URL, removendo o aviso de que os arquivos não estão disponíveis.

Também vale expor um parâmetro opcional `incluir_links` (padrão ligado) e manter o teto de 200 mensagens.

## Documentação e telas

- Atualizar as descrições das duas tools (o texto aparece no OpenClaw) e o catálogo em `/mvp-copiloto` (`ToolCatalogCard.tsx`).
- Atualizar `docs/MCP_julia.md` com os novos campos e o comportamento de links.

## Detalhes técnicos

- Arquivos: `supabase/functions/_shared/copiloto/tools/chat.ts`, `supabase/functions/_shared/copiloto/context.ts`, `supabase/functions/_shared/copiloto/prompts` (se citar formato), `docs/MCP_julia.md`, `src/modules/mvp-copiloto/components/ToolCatalogCard.tsx`.
- Redeploy de `copiloto-mcp` (os arquivos em `_shared` só valem após deploy).
- Somente leitura: nenhuma escrita além do efeito já existente de `chat-media-download` (persistir a mídia baixada), que é o mesmo comportamento do chat ao abrir a conversa.
- Isolamento: `p_client_id` e todos os filtros derivam do token; conversa/contato continuam validados no escopo do escritório.

## Validação

1. No simulador de ferramentas em `/mvp-copiloto`, rodar `julia_chat_listar_conversas` sem filtros e conferir campos ricos + contadores.
2. Repetir com filtro de fila, status e busca por telefone e comparar com a tela `/chat`.
3. Rodar `julia_chat_ler_mensagens` em uma conversa com imagem, áudio e documento e conferir que os links abrem no navegador.
4. Conferir que conversa de outro escritório continua sendo recusada.
