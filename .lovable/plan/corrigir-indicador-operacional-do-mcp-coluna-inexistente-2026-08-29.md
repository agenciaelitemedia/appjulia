# Corrigir indicador operacional do MCP (coluna inexistente)

## Diagnóstico confirmado

A tool `julia_operacao_indicadores` consulta `chat_conversations` pedindo a coluna `last_agent_message_at`, que **não existe** nessa tabela. As colunas reais relevantes são `last_customer_message_at` e `last_message_from_me` (a coluna `last_agent_message_at` existe apenas em outra tabela, das sessões do X-Julia). Como o PostgREST rejeita o `select` inteiro, a tool falha por completo — nenhum indicador é devolvido.

Arquivo: `supabase/functions/_shared/copiloto/tools/operacao.ts` (linhas 288 e 312).

## Correção

1. Trocar o `select` para colunas existentes: `status, assigned_to, opened_at, first_response_at, last_customer_message_at, last_message_from_me`.
2. Recalcular "Aguardando resposta do escritório" com a regra correta: conta a conversa quando `last_message_from_me` é falso/nulo e existe `last_customer_message_at`. Isso substitui a comparação de datas cliente x agente, que dependia da coluna inexistente.
3. Manter o restante do painel igual (total, por status, tempo médio de 1ª resposta, sem responsável, carga por atendente).
4. Redeploy da função `copiloto-mcp` (o arquivo é compartilhado e só entra em vigor após o deploy).

## Validação

- Chamar `julia_operacao_indicadores` pelo simulador de ferramentas em `/mvp-copiloto` e confirmar retorno com todos os indicadores, sem erro de coluna.
- Conferir que os demais tools de operação continuam respondendo normalmente.
