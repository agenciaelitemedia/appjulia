# Mover conversas de filas excluídas para a fila MRA

## Situação atual (verificada no banco)

Client ID **30**. A fila ativa de destino é **MRA** (`9ddbf116…`), hoje com 650 conversas.

Filas excluídas desse cliente que ainda guardam conversas:

| Fila excluída | Conversas | Não resolvidas |
|---|---|---|
| Mario MRC | 303 | 258 |
| MCastro | 310 | 282 |
| Meta Official | 11 | 0 |
| Oficial | 1 | 0 |
| **Total** | **625** | **540** |

As demais filas excluídas (mario, Comercial, Waba etc.) estão sem conversas.

## O que será feito

1. Mover as **625 conversas** dessas 4 filas excluídas para a fila **MRA**.
2. Marcar todas como **resolvidas** (status `resolved`, data de resolução preenchida, com observação de encerramento indicando que vieram de fila excluída). Conversas que já estavam resolvidas/fechadas mantêm o status original.
3. Mover também as **mensagens** vinculadas a essas filas para MRA, para que o histórico continue coerente com a conversa.
4. Registrar cada movimentação no histórico da conversa, para auditoria.

## Detalhes técnicos

- Operação de dados (ferramenta de insert/update), sem mudança de schema.
- `UPDATE chat_conversations SET queue_id = MRA, status = 'resolved', resolved_at = now(), close_note` para as conversas cujo `queue_id` está entre as 4 filas com `is_active = false` do client 30.
- `UPDATE chat_messages SET queue_id = MRA` para o mesmo conjunto de filas.
- `INSERT INTO chat_conversation_history (action = 'queue_migrated_bulk', actor_name = 'system')` para cada conversa movida.
- As filas excluídas permanecem excluídas (não são reativadas).
