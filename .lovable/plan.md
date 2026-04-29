## Migração Telefonia: `cod_agent` → `client_id`

### Contexto e Risco Central

Hoje toda telefonia é particionada por `cod_agent` (texto). O sistema tem N agentes por cliente — `agents.client_id` é 1:N com `agents.cod_agent`. Migrar a chave de partição para `client_id` significa **consolidar todos os ramais/configurações/históricos de todos os agentes de um mesmo cliente sob uma única conta de telefonia**.

⚠️ **Risco semântico fundamental** (precisa decisão antes de migrar):
- Hoje, dois agentes do mesmo cliente podem ter **provedores diferentes**, **planos diferentes** e **ramais isolados**.
- Consolidando em `client_id`, isso vira um único bucket por cliente. Se algum cliente em produção tem >1 agente em telefonia, há **conflito de dados** na migração (qual `phone_config` vence? Os planos somam ou só um sobrevive?).

**Levantamento atual (produção)**:

| Tabela | Linhas | `cod_agent` distintos |
|---|---|---|
| `phone_config` | 5 | 5 |
| `phone_extensions` | 15 | 4 |
| `phone_user_plans` | 4 | 4 |
| `phone_call_logs` | 272 | 3 |

→ Todos os 5 `cod_agent` de `phone_config` (`202603002`, `202601003`, `20259084`, `20251007`, `202603001`) precisam ser mapeados para o `client_id` correspondente em `agents` (DB externo). Antes de qualquer migração executaremos uma **query de validação** para garantir que cada `cod_agent` resolve para exatamente 1 `client_id` e que **não há colisão** (>1 cod_agent em telefonia para o mesmo client_id). Se houver colisão, paramos e pedimos decisão de merge ao usuário.

---

### Escopo do Impacto

**Tabelas afetadas (Lovable Cloud)** — todas precisam de coluna `client_id` (bigint), índice e backfill:
- `phone_config` (chave de partição principal)
- `phone_extensions`
- `phone_user_plans`
- `phone_call_logs`

**Edge Functions afetadas** (todas as queries `.eq('cod_agent', …)` e inserts):
- `telephony-provision` — recebe `client_id` direto da order; remove `resolveCodAgent`
- `telephony-order-create` / `telephony-order-checkout` / `telephony-notify-paid`
- `api4com-proxy` / `api4com-webhook` (resolve por `extension_number` → `client_id`)
- `threecplus-proxy` / `threecplus-webhook`

**Frontend** (~12 arquivos):
- `src/contexts/PhoneContext.tsx` — passa a expor `clientId`; `myExtension` resolvido por `client_id` do `AuthContext` (com fallback para sub-usuário via `getEffectiveClientId`, já existente)
- `src/pages/telefonia/TelefoniaPage.tsx` — **remove o seletor de agente** (passa a ser por cliente). Título passa a mostrar nome do cliente.
- `src/pages/telefonia/hooks/useTelefoniaData.ts`, `useCallHistoryQuery.ts`, `useSyncQueue.ts` — assinaturas mudam de `codAgent` para `clientId`
- `src/pages/telefonia/components/{MeusRamaisTab,DiscadorTab,HistoricoTab,RelatoriosTab}.tsx` — props
- `src/pages/admin/telefonia/types.ts`, `hooks/useTelefoniaAdmin.ts`, `hooks/useTelephonyOrders.ts` — tipos e queries
- `src/pages/admin/telefonia/components/*` — UI admin lista/cria configs/planos por cliente

**Não afetado** (mantém `cod_agent` — escopo de IA/CRM, não telefonia):
- `agents`, `user_agents`, `crm_*`, `chat_*`, contratos, copilot, support, queue_agent_links, contract_notification, csat — **nada disso muda**.

---

### Plano de Execução (4 fases, com gates)

#### Fase 0 — Validação prévia (read-only, antes de qualquer DDL)
1. Rodar via `db-query`: `SELECT cod_agent, client_id FROM agents WHERE cod_agent IN (...5 valores...)`.
2. Construir o mapa `cod_agent → client_id` e checar:
   - Todo `cod_agent` resolve? (se não → abortar e listar órfãos)
   - Algum `client_id` aparece >1 vez? (se sim → **GATE**: pedir ao usuário regra de merge)
3. Apresentar relatório ao usuário **antes** de seguir para Fase 1.

#### Fase 1 — Schema aditivo (não-destrutivo, totalmente reversível)
Migration adiciona `client_id BIGINT NULL` em cada uma das 4 tabelas + índice. **Mantém** `cod_agent` intacto. Nenhuma constraint NOT NULL ainda.

```text
ALTER TABLE phone_config     ADD COLUMN client_id BIGINT;
ALTER TABLE phone_extensions ADD COLUMN client_id BIGINT;
ALTER TABLE phone_user_plans ADD COLUMN client_id BIGINT;
ALTER TABLE phone_call_logs  ADD COLUMN client_id BIGINT;
CREATE INDEX ... ON ... (client_id);
```

#### Fase 2 — Backfill (insert-tool com UPDATEs idempotentes)
Para cada par do mapa Fase 0:
```text
UPDATE phone_config     SET client_id = <id> WHERE cod_agent = '<cod>' AND client_id IS NULL;
UPDATE phone_extensions SET client_id = <id> WHERE cod_agent = '<cod>' AND client_id IS NULL;
UPDATE phone_user_plans SET client_id = <id> WHERE cod_agent = '<cod>' AND client_id IS NULL;
UPDATE phone_call_logs  SET client_id = <id> WHERE cod_agent = '<cod>' AND client_id IS NULL;
```
Verificação pós-backfill: `SELECT count(*) WHERE client_id IS NULL` em cada tabela = 0.

#### Fase 3 — Código dual-write (deploy seguro)
Edge functions e frontend passam a:
- **Ler** preferencialmente por `client_id` (com fallback `cod_agent` se `client_id` for NULL — defesa em profundidade)
- **Escrever** sempre **ambos** os campos (`client_id` + `cod_agent` derivado de `agents` quando aplicável). Isso evita janelas de inconsistência entre deploys do Edge e do front.

Ordem do deploy:
1. Edge functions (todas no mesmo commit)
2. Frontend
3. Smoke test em produção: criar pedido novo, ligar de um ramal existente, ver histórico, abrir admin de telefonia.

#### Fase 4 — Limpeza (após validação em produção, mínimo 7 dias)
- Migration: tornar `client_id NOT NULL` nas 4 tabelas
- Remover fallbacks `cod_agent` do código
- (Opcional) Remover coluna `cod_agent` em uma migration final marcada como destrutiva — recomendo **manter** a coluna por ora, custa nada e simplifica eventual rollback/auditoria.

---

### Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| **Colisão**: 2 agentes do mesmo cliente já têm telefonia ativa | Gate na Fase 0; sem aprovação explícita do usuário, abortar. |
| Webhook entra entre o backfill e o deploy do código | Dual-write na Fase 3 garante que escrita por `cod_agent` continue funcionando até o último deploy. |
| Frontend vê dados duplicados (mesmo cliente em múltiplas linhas) | Após backfill, `SELECT client_id, count(*) FROM phone_config GROUP BY 1 HAVING count>1` precisa retornar 0; senão para. |
| Quebra do Discador/PhoneContext em produção (perda de ramal) | Manter `cod_agent` populado; PhoneContext lê primeiro `client_id`, fallback `cod_agent`. |
| RLS / permissões alteradas | Nenhuma das 4 tabelas tem RLS atualmente (são internas a Edge); validamos antes de mexer. |
| Realtime (`telephony_orders`) | Não afetado — `telephony_orders` já usa `client_id`. |
| Sub-usuários sem `client_id` próprio | `AuthContext` já hidrata via `externalDb.getEffectiveClientId(user.id)` — reutilizamos. |
| Provisão de pedidos antigos pendentes | `telephony-provision` continua resolvendo `cod_agent` enquanto a coluna existir; novos pedidos vão direto por `client_id`. |
| Rollback emergencial | Fases 1–3 são 100% reversíveis (basta reverter código; coluna nova fica órfã sem dano). Fase 4 é o ponto de não-retorno. |

---

### Decisões necessárias antes de começar

Antes de iniciar a Fase 1, preciso que você confirme:

1. **Política de merge se 2+ agentes do mesmo cliente tiverem telefonia ativa**: manter o mais recente? Somar ramais? Pedir caso a caso? (resultado da Fase 0 dirá se é necessário)
2. **Manter UI seletor de agente em `/telefonia`?** Minha proposta: **remover** (passa a ser uma única conta por cliente). Confirma?
3. **Quando executar a Fase 4 (limpeza)?** Proposta: 7 dias após Fase 3 estável. Ok?

Aprovando este plano, começo pela Fase 0 (apenas leitura) e te apresento o relatório de mapeamento antes de tocar em schema.