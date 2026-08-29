# Alternativa permitida ao bridge de extensão: Julia como conector MCP do ChatGPT

## O diagnóstico

A ponte por extensão automatiza a interface do `chatgpt.com` e chama endpoints internos. Isso já disparou o anti-bot ("Unusual activity has been detected from your device") e, pelo próprio `x-julia-GPT-co-piloto.md` (seção 4), contraria os termos da OpenAI: a assinatura ChatGPT pode dar identidade e rodar apps **dentro** do ChatGPT, mas não alimentar inferência no produto de terceiro. Continuar nesse caminho mantém o risco de suspensão da conta do escritório.

A saída permitida está documentada como **Rota 1**: inverter o sentido. Em vez de a Julia dirigir o ChatGPT do advogado, a Julia expõe um **conector MCP** que o ChatGPT (e o Claude) consomem. O advogado usa a assinatura Pro dele, dentro da interface oficial, sem custo de token para a Julia e sem automação de navegador.

```text
Antes (risco)    Julia -> extensão -> DOM/endpoints internos do chatgpt.com
Depois (oficial) ChatGPT Pro do advogado -> OAuth 2.1 + PKCE -> MCP da Julia -> dados do lead
```

## O que muda no MVP

A rota `/mvp-copiloto` deixa de instalar extensão e passa a ser a **tela de conexão + validação do conector**:

1. **Cartão "Conectar seu ChatGPT/Claude"** — mostra a URL do conector para colar em *Settings → Connectors → Add custom connector*, com passo a passo e status da conexão (tokens ativos, último uso, botão revogar).
2. **Escolher lead** — igual ao MVP atual (busca por telefone/nome, prévia do contexto compilado). Serve para conferir o que o conector entregará.
3. **Simulador local** — botão "Testar como o ChatGPT veria": chama o próprio MCP com um token do usuário logado e mostra o retorno de `tools/list` e da tool de análise. Valida o conector sem depender do ChatGPT.
4. **Fallback dentro da Julia** — a mesma análise jurídica rodando pelo gateway de IA já usado no projeto, para quem não quiser conectar conta Pro. Entrega valor imediato e não depende de aprovação de ninguém.

Do lado do ChatGPT, o advogado pede em linguagem natural ("analise o atendimento do lead 5519…") e o ChatGPT chama as tools da Julia. O prompt jurídico fixo do MVP passa a ser a descrição/instrução da tool `analisar_atendimento`.

## Ferramentas expostas (MVP enxuto)

| Tool | O que faz |
| --- | --- |
| `buscar_lead` | Busca contato/conversa por telefone ou nome, no escritório do token |
| `obter_historico` | Histórico compilado da conversa (até 100 mensagens, transcrições, nomes de anexos) |
| `analisar_atendimento` | Devolve o contexto + instrução da análise: resumo do atendimento, do que se trata, viabilidade jurídica com o que falta de prova, outros casos possíveis |

## Detalhes técnicos

- Duas edge functions novas, `copiloto-oauth` (authorization server: descoberta, `/authorize`, `/token`, revogação) e `copiloto-mcp` (Streamable HTTP, `initialize`, `tools/list`, `tools/call`), ambas com `verify_jwt = false` em `supabase/config.toml` — exceção legítima, pois carregam a própria autenticação OAuth.
- Descoberta em `/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server` na raiz de `acesso.atendejulia.com.br`, com rewrite para a function. OAuth 2.1 com PKCE `S256` obrigatório; ChatGPT como cliente público, Claude com Client ID/Secret.
- Tela de consentimento usa o login existente (`AuthContext`/bcrypt). O `client_id` do escritório é resolvido **no servidor** (`COALESCE(u.client_id, parent.client_id)`) e gravado no token; nenhuma tool aceita `client_id` como argumento — obrigatório porque a RLS do projeto é permissiva.
- Tabelas novas (prefixo `cop_`): clientes OAuth, códigos de autorização (TTL 60s, uso único), tokens com escopos e `last_used_at`. `GRANT` + RLS em cada uma.
- Reaproveita o compilador de contexto já escrito em `src/modules/mvp-copiloto/lib/buildLeadContext.ts` e os prompts de `lib/prompts.ts`, movendo a lógica para `supabase/functions/_shared/copiloto/`.
- A pasta `extension/` e o `.zip` público saem do fluxo (ficam apenas como referência histórica ou são removidos, conforme sua preferência).
- Nada fora de `src/modules/mvp-copiloto/`, das duas functions e do `config.toml` é alterado.

## Limites honestos

- No ChatGPT, conectores personalizados hoje passam por *Developer mode* / revisão do App Directory para distribuição ampla; no Claude a adição é imediata. A validação do MVP começa pelo Claude e pelo simulador local, e o ChatGPT entra assim que o app for aprovado.
- A resposta é gerada na conta do advogado: rate limits do plano dele valem, e a Julia recebe o resultado apenas se ele copiar/salvar de volta — ou pela Rota 2 (fallback interno), que grava normalmente.

## Validação

1. Conector adicionado no Claude Pro: consentimento mostra escritório e escopos, `tools/list` retorna as três tools.
2. Pergunta "analise o atendimento do lead X" devolve as quatro seções pedidas.
3. Token de um escritório não consegue ler lead de outro escritório.
4. Simulador em `/mvp-copiloto` reproduz o mesmo retorno sem sair do app.
5. Fallback interno gera a mesma análise pelo gateway de IA.
