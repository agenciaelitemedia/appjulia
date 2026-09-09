# Conector MCP: por que só aparece o escritório 300 e por que o Mário "não conecta"

## Diagnóstico (verificado nos dados agora)

1. **A conta do Mário existe e o login do conector funciona.**
   `mario@atendejulia.com.br` é usuário ativo, papel admin, escritório **30 — "Mario Castro"**.
   Hoje foram emitidos 4 tokens OAuth para esse e-mail (12:59, 14:26, 17:27 e 17:44), todos com
   escritório 30, nenhum revogado. Dois deles registram uso (`last_used_at` 12:59, 14:27, 17:27).
   Ou seja: autorização, consentimento e emissão de token estão OK.

2. **As ferramentas, porém, estão sendo executadas por outra conexão.**
   Todas as chamadas de ferramenta de hoje na auditoria (`cop_tool_calls`) aparecem com
   escritório **300**, que pertence às conexões antigas de `tellmoitas@gmail.com`
   (ChatGPT, usada 17:45) — e há também uma conexão de `ceo@grupoamjuridico.com` (escritório 294).
   Nenhuma chamada de ferramenta foi registrada com escritório 30.

3. **Há muitas recusas por falta do token.**
   `cop_auth_failures` mostra dezenas de registros `sem_bearer` hoje (17:26 a 17:45): o runtime
   chamou o conector sem repassar o `Authorization: Bearer`. Nesses casos o cliente MCP tende a
   responder pela conexão que ainda está válida — a de escritório 300.

**Conclusão:** não é um bloqueio do lado da Julia. O conector está com **mais de um servidor/conexão
configurados no mesmo cliente**, com nomes de ferramentas idênticos; as chamadas caem na conexão
antiga (escritório 300) e a nova (escritório 30, do Mário) fica sem uso. O que falta é o conector
deixar visível *qual* conexão respondeu e o cliente ficar com apenas uma.

## Bug adicional confirmado

`julia_agentes_listar` falha sempre com erro interno (4 ocorrências hoje). A consulta usa
`owner_name`, `business_name`, `whatsapp`, `is_active` — nenhuma dessas colunas existe na tabela
`agents`, que tem `cod_agent`, `client_id`, `user_id`, `settings`, `status`. Erro real retornado:
`column "owner_name" does not exist`.

## O que será feito

### 1. Identificar a conexão em toda resposta
- `initialize` passa a publicar no `serverInfo`/instruções o escritório efetivo (id + nome) e o
  e-mail do token, para que dois servidores configurados no mesmo cliente sejam distinguíveis.
- Nova ferramenta somente-leitura `julia_sessao_atual`: devolve e-mail do token, id e nome do
  escritório, escopos e validade — resposta objetiva para "com qual conta eu estou conectado?".
- O recurso `julia://escritorio/perfil` passa a incluir também o **nome** do escritório
  (hoje só mostra e-mail, contagens e escopo).

### 2. Corrigir `julia_agentes_listar`
Reescrever a consulta com as colunas reais de `agents` (`cod_agent`, `status`, `user_id`,
nome/empresa/telefone extraídos de `settings`, com junção em `users` para o titular), mantendo o
filtro por escritório do token.

### 3. Facilitar a limpeza das conexões duplicadas
No cartão de conexões de `/mvp-copiloto`, mostrar por conexão: e-mail, escritório (id + nome),
cliente MCP, último uso e botão de revogar — para revogar as conexões antigas (300/294) e ficar
apenas com a do Mário.

### 4. Ação fora do código (sua)
No OpenClaw/ChatGPT: remover o servidor MCP antigo (o que autenticou como `tellmoitas@gmail.com`)
e manter apenas um, reconectado com `mario@atendejulia.com.br`. Enquanto existirem dois com as
mesmas ferramentas, as chamadas continuarão caindo no escritório 300.

## Detalhes técnicos
- `supabase/functions/copiloto-mcp/index.ts`: resolver o nome do escritório (tabela `clients`, via
  `db-query`) após validar o token; incluir em `serverInfo`, instruções e no recurso de perfil.
- `supabase/functions/_shared/copiloto/tools/operacao.ts`: nova tool `julia_sessao_atual` e correção
  da consulta de `julia_agentes_listar`.
- `src/modules/mvp-copiloto/components/McpConnectionCard.tsx`: colunas de e-mail/escritório/último uso.
- Nenhuma migration. Redeploy de `copiloto-mcp`.

## Validação
1. `julia_sessao_atual` com o token do Mário responde escritório 30 — "Mario Castro".
2. `julia_agentes_listar` responde sem erro interno nos escritórios 30 e 300.
3. Após remover o servidor antigo no cliente MCP, `cop_tool_calls` registra novas chamadas com
   `client_id = 30` e `cop_auth_failures` para de acumular `sem_bearer`.
