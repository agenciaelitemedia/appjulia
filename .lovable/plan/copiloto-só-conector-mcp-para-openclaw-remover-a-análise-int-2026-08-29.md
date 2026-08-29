# Copiloto: só conector MCP (para OpenClaw) — remover a análise interna da Julia

## Decisão

A análise feita pela IA interna da Julia sai de cena. A página passa a ter uma única função: **entregar e administrar o conector MCP** que você conecta no OpenClaw (ou ChatGPT/Claude), e é o OpenClaw — com sua conta Pro — que faz as análises usando as ferramentas da Julia.

Sim, é possível e é o caminho seguro: o OpenClaw suporta servidores MCP remotos com OAuth. Ele nunca recebe senha nem chave do banco; recebe apenas um token de acesso emitido pela Julia depois de você fazer login e aprovar o consentimento — e esse token carrega o escritório (`client_id`) resolvido no servidor.

## Como fica o acesso restrito a uma única conta

Já é assim por construção, e o plano reforça:

- No login de consentimento você entra com o e-mail/senha da Julia; o servidor resolve `julia_client_id` e grava no token. As tools **ignoram** qualquer `client_id` enviado como argumento.
- Escopo único `leads:read` — somente leitura de leads, histórico e análise textual. Nada de escrita, envio de mensagem ou exclusão.
- Todo token aparece na lista de conexões da página, com nome do cliente MCP, data de criação e último uso, e pode ser revogado a qualquer momento (exige sua senha).
- Tokens expiram e são renovados por refresh token; revogar corta o acesso na hora.

## O que remover

- Edge Function `copiloto-analisar` (deletar) e sua entrada em `supabase/config.toml`.
- `useCopilotoAnalysis.ts`, `AnalysisResult.tsx`, `ContextPreview.tsx` e o botão "Analisar atendimento".
- `requestSimulatorToken` / rota `POST /simulate-token` no `copiloto-oauth`, e o campo de senha da análise na página.
- O card de instruções perde o "Caminho 1"; fica um passo a passo único.

Mantidos: `copiloto-oauth` (OAuth 2.1 + PKCE + consentimento), `copiloto-mcp` (tools `buscar_lead`, `obter_historico`, `analisar_atendimento` — esta última passa a devolver **o contexto compilado + o comando de análise** como texto, para o modelo do OpenClaw analisar), `McpConnectionCard` e o simulador de tools (útil para testar sem sair da Julia; passa a usar um token do próprio conector, não o token de simulação).

## Nova página /mvp-copiloto

1. **Cartão "Conectar no OpenClaw"** — URL do conector com botão copiar, e passo a passo:
   - adicionar servidor MCP remoto no OpenClaw apontando para a URL;
   - o OpenClaw abre o navegador → login na Julia → tela de consentimento mostrando escritório, escopo `leads:read` e o cliente que está pedindo acesso;
   - aprovar → o OpenClaw guarda o token e passa a listar as tools;
   - exemplo de pedido no chat: "busque o lead 5519… na Julia e faça a análise jurídica do atendimento".
2. **Cartão "Conexões ativas"** — lista de tokens (cliente, criado em, último uso, escopo) com revogação individual.
3. **Cartão "Testar ferramentas"** — simulador que chama `tools/list` e `tools/call` com uma conexão ativa, para confirmar que o retorno é o esperado antes de usar no OpenClaw.
4. **Aviso de segurança** — leitura apenas, por escritório, revogável, sem cookies/sessão de terceiros; nada é gravado no atendimento.

## Detalhes técnicos

- `supabase/functions/_shared/copiloto/tools.ts`: `analisar_atendimento` retorna `ANALYSIS_COMMAND` + contexto compilado (sem chamar gateway). O contexto continua limitado às últimas 100 mensagens do contato do escritório do token.
- `supabase/functions/copiloto-oauth/index.ts`: remover `/simulate-token`; manter discovery, DCR, authorize/consent, token, refresh e revoke.
- `supabase/functions/copiloto-mcp/index.ts`: sem mudança de contrato; conferir `WWW-Authenticate` e `/.well-known/oauth-protected-resource` (é o que o OpenClaw usa para descobrir o servidor de autorização).
- Frontend: `src/modules/mvp-copiloto/` — remover os arquivos citados, reescrever `MvpCopilotoPage.tsx` e enxugar `copilotoApi.ts`.
- Nenhuma migration: tabelas `cop_oauth_*` permanecem como estão.

## Validação

1. Deploy das funções; discovery (`/.well-known/oauth-authorization-server`) responde e `copiloto-mcp` sem token retorna 401 com `WWW-Authenticate`.
2. Conectar no OpenClaw, concluir login + consentimento, listar tools e rodar `buscar_lead` + `analisar_atendimento` de um lead real.
3. Confirmar na página que a conexão aparece com último uso atualizado e que a revogação derruba o acesso (próxima chamada volta 401).
4. Confirmar que um token de um escritório não retorna leads de outro.
