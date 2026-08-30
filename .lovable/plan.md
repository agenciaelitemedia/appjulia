# Diagnóstico e correção do "erro de autenticação do MCP no runtime"

## O que os dados mostram

Verifiquei o backend do conector no horário exato da reclamação (19:02 BRT = 22:02 UTC):

| Evidência | Resultado |
| --- | --- |
| `cop_tool_calls` nas últimas 6h | 12 chamadas, **todas com `status: ok`** — inclusive `julia_crm_listar_etapas` (22:04 UTC) e `julia_crm_listar_leads` (22:04 UTC, `stage_id: 1`) |
| Nenhuma linha com `status: error` | O pedido que falhou **nunca chegou ao dispatcher** de tools |
| `cop_oauth_tokens` do escritório em uso (client 300) | token ativo, `expires_at` 29/09, `revoked_at` nulo, `last_used_at` 22:04 UTC |
| Logs da function | um `401` em requisição **GET sem Bearer** |

Ou seja: o CRM respondeu, o escopo `leads:read` é aceito nas tools de leitura, e o token não está revogado nem expirado. A falha aconteceu **antes** da execução da tool — na validação do Bearer (401 `invalid_token`), que hoje não é registrada em lugar nenhum.

## Causa provável (confirmada no código)

No `POST /token` com `grant_type=refresh_token` (`supabase/functions/copiloto-oauth/index.ts`), a renovação **sobrescreve a mesma linha**: `access_token` e `refresh_token` novos substituem os antigos na hora, sem qualquer período de graça.

Consequência: assim que um processo do cliente MCP renova o token, **qualquer outro processo/runtime que ainda tenha o access token anterior passa a receber 401 `invalid_token`** — exatamente o quadro descrito ("o catálogo está acessível, os dados do escritório não", "a autorização salva não está chegando ao runtime"). O mesmo acontece se uma renovação for repetida/retentada: a segunda tentativa usa um refresh token já rotacionado e recebe `invalid_grant`, deixando o runtime sem token válido.

Dois problemas secundários encontrados no caminho:

1. O documento `/.well-known/oauth-protected-resource` anuncia os escopos de escrita como `julia:write:crm` / `julia:write:messages` (dois-pontos), mas o código exige `julia:write.crm` / `julia:write.messages` (ponto). Um cliente que peça o escopo anunciado nunca conseguirá usar as tools de escrita.
2. Requisições `GET` (stream SSE que vários clientes abrem) só recebem `401`/`405` genéricos, o que alguns runtimes interpretam como "sessão inválida".

## O que fazer

1. **Renovação sem derrubar o token anterior** — na rotação, manter o access token antigo válido por uma janela curta de graça (5 min) em vez de apagá-lo, e tolerar reuso do refresh token dentro da mesma janela devolvendo o par vigente (comportamento recomendado pelo OAuth 2.1 para clientes com retentativa). Sem isso, qualquer renovação continua causando o 401 de hoje.
2. **Registrar as falhas de autenticação** — gravar 401 (`sem_bearer`, `token_desconhecido`, `expirado`, `revogado`, `rotacionado`) numa tabela/linha de auditoria e expor no painel de Observabilidade de `/mvp-copiloto`, para que este diagnóstico deixe de depender de investigação manual.
3. **Mensagem de erro precisa** — a resposta 401 passa a dizer qual dos casos ocorreu (sem expor o token), e o `WWW-Authenticate` carrega `error="invalid_token"` / `error_description`, que é o que o cliente MCP mostra ao usuário.
4. **Corrigir os nomes dos escopos** anunciados no metadata para `julia:write.crm` e `julia:write.messages`.
5. **Tratar `GET`** com resposta explícita (405 com corpo informando que o transporte é POST JSON-RPC) quando o Bearer for válido, evitando leitura errada de "sessão inválida".

## Detalhes técnicos

- `supabase/functions/copiloto-oauth/index.ts`: no ramo `refresh_token`, gravar `previous_access_token` + `previous_token_expires_at` (graça de 5 min) e aceitar refresh já rotacionado dentro dessa janela; sem mudança no PKCE, consentimento ou revogação.
- Migration: colunas `previous_access_token`, `previous_token_expires_at` em `cop_oauth_tokens` (index parcial para lookup) e tabela `cop_auth_failures` (`created_at`, `reason`, `token_prefix_hash`, `client_hint`, `path`, `ip_hash`) com RLS e GRANTs no padrão do projeto.
- `supabase/functions/copiloto-mcp/index.ts`: lookup aceita `access_token` **ou** `previous_access_token` dentro da graça; classifica e registra o motivo do 401; `WWW-Authenticate` com `error`/`error_description`; escopos do metadata corrigidos; `GET` com resposta explicativa.
- Frontend `src/modules/mvp-copiloto/`: novo bloco "Falhas de autenticação" no cartão de Observabilidade (motivo, horário, contagem) e nota no cartão de conexões quando houver rotação recente.
- Redeploy de `copiloto-oauth` e `copiloto-mcp`.

## Validação

1. Emitir token, renovar e confirmar que **o access token antigo continua funcionando por 5 min** e o novo também.
2. Repetir o mesmo `refresh_token` duas vezes e confirmar que a segunda chamada devolve o par vigente em vez de `invalid_grant`.
3. Chamar `julia_crm_listar_etapas` e `julia_crm_listar_leads` com o token do escritório e confirmar contagem real da etapa "Entrada".
4. Chamar sem Bearer e com Bearer inválido: 401 com motivo distinto, e as duas ocorrências visíveis no painel.
5. Revogar a conexão e confirmar 401 `revogado` na chamada seguinte.
