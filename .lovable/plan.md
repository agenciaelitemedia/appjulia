# Tela de chat com o agente Julia do OpenClaw (`/mvp-gpt`)

Objetivo: falar com o agente supervisor da Julia que já usa o MCP `atende_julia`, direto de uma tela do sistema, sem terminal e sem Telegram. Somente leitura nesta primeira versão.

## Decisões assumidas (você deixou a meu critério)

- Rota `/mvp-gpt`, módulo isolado em `src/modules/mvp-gpt/`, com `extend/` como nos módulos recentes.
- Acesso restrito a **admin** (mesma regra do `AdminRoute`), por ser MVP com acesso amplo de leitura.
- Credenciais do Gateway ficam como **secrets do backend**, criados vazios e preenchidos por você antes do primeiro teste: `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_AGENT_ID` (padrão `julia-supervisora`).
- Nenhum token trafega para o navegador.

## Fluxo

```text
Tela /mvp-gpt
  -> POST edge function  mvp-gpt-chat  { conversationId, message, userId }
       - valida usuário no banco legado (db-query) e resolve client_id efetivo
       - grava mensagem do usuário
       - chama Gateway OpenClaw /v1/responses (stream) com
           x-openclaw-agent-id: <OPENCLAW_AGENT_ID>
           x-openclaw-session-key: julia:{clientId}:{conversationId}
       - repassa o stream (SSE) para a tela
       - ao final grava a resposta do assistente
  -> agente consulta o MCP atende_julia (OAuth já publicado em mcp.atendejulia.com.br)
```

## Backend

Nova edge function `mvp-gpt-chat` (`verify_jwt=false`, padrão do projeto, validação em código):

- Entrada validada com zod: `conversationId` (uuid), `message` (1..4000), `userId`.
- Autorização: consulta o usuário via `db-query` (ativo, role admin) e resolve `client_id` efetivo pela mesma regra de herança já usada no sistema. **O `client_id` nunca vem do corpo da requisição.**
- Verifica que a conversa pertence ao par (`client_id`, `user_id`) antes de continuar.
- Rate limit simples por usuário (ex.: 20 mensagens / 5 min), contando em tabela.
- Chamada ao Gateway sempre em **streaming**, sem timeout por temporizador; cancelamento apenas se o usuário abortar (repassa `request.signal`).
- Erros traduzidos para mensagens amigáveis: gateway sem configuração, `401/403` (inclui o caso `Auth required` do MCP, com dica de reautorizar o conector), `429`, `5xx`.
- Logs sem token e sem conteúdo das mensagens — apenas ids, tamanho, duração e status.

Duas tabelas novas (Supabase), com GRANT e RLS habilitada:

```text
gpt_conversations  id, client_id, user_id, title, created_at, updated_at
gpt_messages       id, conversation_id, role, content, status, created_at
```

Como a autenticação do sistema não é Supabase Auth, o isolamento efetivo é feito na edge function (service role); as políticas ficam restritivas, sem acesso anônimo direto.

## Frontend (`src/modules/mvp-gpt/`)

- `pages/MvpGptPage.tsx`: lista de mensagens, campo de texto, enviar, “Nova conversa”, indicador “Julia está analisando”, erro com botão de tentar novamente.
- Barra lateral simples com as conversas do usuário.
- Quatro sugestões iniciais: resumo dos atendimentos de hoje, leads para follow-up, casos prioritários, gargalos da operação.
- Streaming renderizado incrementalmente; o texto pensado/parcial aparece conforme chega.
- Aviso fixo: agente em modo leitura; nada é enviado a clientes.
- `extend/db.ts` e `extend/auth.ts` reexportando `supabase` e `useAuth`, sem tocar em nada existente.
- Rota registrada em `App.tsx` dentro do guard de admin.

## Fora do escopo deste MVP

Voz, anexos, múltiplos agentes, execução automática e qualquer operação de escrita/envio pelo agente.

## Bloqueio conhecido

O MCP respondeu `Auth required` no seu teste anterior. A tela funciona sem isso, mas o agente só consulta dados da Julia depois de a autorização OAuth do conector estar concluída para o escritório. A tela mostrará esse estado explicitamente quando o agente reportar falta de autorização.

## Validação

1. Enviar “Resuma os atendimentos de hoje” e ver resposta em streaming.
2. Recarregar a página e confirmar que o histórico persiste.
3. Conferir no banco que a conversa está gravada com o `client_id` da sessão.
4. Tentar abrir conversa de outro escritório e receber recusa.
5. Confirmar que nenhum token aparece na aba de rede do navegador.
