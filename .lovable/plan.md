## Objetivo

Garantir que **todo o fluxo de pedido de telefonia** (criação → checkout → pagamento → provisionamento → exibição admin) use `client_id` como chave principal, mantendo `cod_agent` como campo opcional/legado para não quebrar nada que já depende dele (proxies Api4Com/3C+, telas existentes).

## Diagnóstico atual

Mapeei o uso de `cod_agent` no fluxo:

| Etapa | Estado atual | Ação necessária |
|---|---|---|
| `telephony-order-create` | Já não exige `cod_agent` | Nenhuma |
| `telephony-order-checkout` / `mercadopago-webhook` | Não tocam `cod_agent` | Nenhuma |
| `telephony-provision` | Já trata `cod_agent` como opcional + tenta herdar | Reforçar (ver abaixo) |
| `phone_config.cod_agent` | **Já é nullable** (migração anterior) | Nenhuma |
| `phone_user_plans.cod_agent` | Já é nullable | Nenhuma |
| `phone_extensions.cod_agent` | **NOT NULL** ainda | Tornar nullable (próximo gargalo natural ao criar ramal) |
| `telephony_orders.cod_agent` | Coluna existe, é opcional | Nenhuma |
| `api4com-proxy` / `threecplus-proxy` | Usam `client_id` quando vem; senão fallback `cod_agent` | Manter como está (compatibilidade) |
| Telas admin (`ConfigTab`, `EditTelefoniaDialog`, `AgentsTelefoniaTab`, `CallHistoryAdminTab`) | Apenas **exibem** `cod_agent` quando existe (com `&&`) | Nenhuma — já tolera `null` |
| `useTelefoniaAdmin` (dual-write) | Tenta resolver `cod_agent` via `agents.client_id`; se vazio, salva string `''` | Ajustar para salvar `null` em vez de `''` |

Nota importante: `useTelefoniaData` e os proxies usam `cod_agent` como fallback de escopo quando `client_id` não está disponível no contexto chamador. Não vou remover esse fallback — apenas garantir que `client_id` seja preferido quando presente, o que já é o comportamento atual.

## Mudanças

### 1. Migração de schema (mínima, segura)

```sql
-- Remove o último NOT NULL do trio principal do fluxo de pedido.
-- Permite que ramais criados pelo provisionamento client_id-first não falhem.
ALTER TABLE public.phone_extensions ALTER COLUMN cod_agent DROP NOT NULL;
```

Sem impacto: linhas existentes continuam preenchidas; o frontend já checa `cod_agent &&` antes de exibir.

### 2. `supabase/functions/telephony-provision/index.ts`

Pequeno hardening:
- Trocar `(cfgPayload.cod_agent = codAgent)` para enviar `null` explícito quando ausente (em vez de omitir do payload), garantindo que o INSERT não quebre se algum default antigo tentar exigir o campo.
- Adicionar log claro: `console.log('[telephony-provision] cod_agent ausente — provisionando puramente por client_id', clientId)` quando aplicável.

### 3. `src/pages/admin/telefonia/hooks/useTelefoniaAdmin.ts`

- Trocar `cod_agent: codAgent || ''` por `cod_agent: codAgent ?? null` nos dois pontos de INSERT (`createConfig` e `provisionConfig`), para refletir corretamente o estado "sem agente vinculado" e evitar que strings vazias contaminem queries posteriores (`.eq('cod_agent', '')`).

### 4. `src/pages/admin/telefonia/types.ts`

Tornar opcionais nas interfaces para refletir realidade do banco:
```ts
PhoneConfig.cod_agent: string | null
PhoneUserPlan.cod_agent: string | null  // (já está)
PhoneExtension.cod_agent: string | null
TelephonyOrder.cod_agent: string | null  // (já está)
```

Telas que renderizam `{cfg.cod_agent && (...)}` continuam funcionando.

## O que NÃO vou mexer (para evitar impactos)

- `api4com-proxy` e `threecplus-proxy`: continuam aceitando `cod_agent` como fallback. Migração total para `client_id` puro será uma fase futura.
- `phone_extensions` UI de criação manual: continua passando `cod_agent` quando disponível (não-breaking).
- `db-query` e funções não-telefônicas que usam `cod_agent` (agents, user_agents, leads): fora do escopo deste pedido.
- Não vou alterar `phone_config` / `phone_user_plans` (já corrigidos).

## Resultado esperado

Após a aprovação:
- Pedido → checkout → pagamento → provisionamento funciona puramente com `client_id`, mesmo para clientes sem nenhum `cod_agent` cadastrado.
- Configuração aparece em `admin/telefonia → Configurações` mesmo sem `cod_agent`.
- Criação posterior de ramais não vai mais bater no NOT NULL de `phone_extensions.cod_agent`.
- Tudo que já usa `cod_agent` continua funcionando inalterado.