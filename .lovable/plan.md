
## Objetivo

Eliminar a fragilidade de filtrar atribuições por **nome** (`assigned_to`) introduzindo um identificador estável do usuário (`assigned_user_id`, bigint = `agents.cod_agent`) ao lado do nome atual. O nome continua sendo gravado para exibição e compatibilidade; o id passa a ser a fonte de verdade para joins, filtros e métricas.

---

## 1. Migração de schema

Adicionar coluna `assigned_user_id bigint NULL` em:

- `chat_conversations`
- `crm_deals`
- `support_tickets`
- `tasks` (e considerar `task_items` se houver atribuição individual)

Para cada tabela:
- Índice `(client_id, assigned_user_id)` para acelerar dashboards.
- Sem FK rígida para `agents` (evita travar inserts em cenários legados); validação fica na aplicação.
- Manter `assigned_to`/`assigned_to_name`/`assigned_name` como estão.

Atualizar triggers que sincronizam atribuição entre módulos para propagar também o id:
- `sync_conversation_to_deal` e `sync_deal_to_conversation` passam a copiar `assigned_user_id` junto com `assigned_to`/`priority`.

## 2. Backfill (match exato por nome)

Rodar um `UPDATE ... FROM agents` por tabela usando match **exato** após normalização (`trim` + `lower`) entre `assigned_to` e o nome do agente (campo de exibição já usado pelo app), restrito ao mesmo `client_id`. Linhas sem match único ficam `NULL` e seguem caindo no fallback por nome até serem reatribuídas.

## 3. Escrita (dual-write no frontend/edge)

Onde hoje gravamos `assigned_to = "Nome"`, passar a gravar também `assigned_user_id = <id>`:
- Atribuição manual no chat (transferir/assumir conversa).
- Atribuição no CRM (drag-and-drop, edição de card, automações).
- Criação/atribuição de ticket de suporte.
- Criação/atribuição de task.
- Roteamento automático (`chat_routing_rules`, automações) — incluir id quando o destino for um agente identificável.

## 4. Leitura (dual-read)

Padronizar as consultas para preferir id e cair no nome quando o id estiver `NULL`:

```
.or(`assigned_user_id.eq.${id},and(assigned_user_id.is.null,assigned_to.ilike.%${name}%)`)
```

Pontos a atualizar:
- `useUserConversations` (origem desta conversa) e demais hooks de `/equipe`.
- Filtros “meus” em chat, CRM, suporte e tasks.
- Views/queries de dashboard que agrupam por atendente.

## 5. Rollout

1. Migração + índices.
2. Backfill em uma transação por tabela.
3. Deploy do dual-write.
4. Deploy do dual-read (chat → CRM → suporte → tasks).
5. Monitorar % de linhas novas com `assigned_user_id IS NULL`; quando estável próximo de 0, planejar etapa futura para remover o fallback por nome (fora deste plano).

---

## Detalhes técnicos

- Tipo: `bigint` para casar com `agents.cod_agent` (regra do projeto).
- Sem alteração em RLS (políticas atuais não dependem de assigned_to).
- Triggers de sync entre `chat_conversations` e `crm_deals` precisam ser ajustadas no mesmo migration para não “zerar” o id ao propagar mudanças.
- Nenhuma quebra de contrato com integrações externas (UaZapi/WABA/n8n) — o nome continua presente.

## Fora de escopo

- Remover `assigned_to` (nome) — fica para depois do período de coexistência.
- Reescrever automações/n8n que ainda referenciam só nome.
- Atribuição de múltiplos responsáveis.
