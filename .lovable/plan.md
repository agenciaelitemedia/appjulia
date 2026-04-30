## Problema

Você criou o ramal **1015 (Mario Castro / id=44)** para o **client_id=30**, mas o softphone aparece **offline**. Após análise dos dados:

| Item | Valor |
|---|---|
| Ramal `id=44` | extension `1015`, `assigned_member_id=2`, `client_id=30`, **`cod_agent=NULL`** |
| `phone_config` (client 30) | `provider=api4com`, `cod_agent=NULL` ✅ |
| `phone_user_plans` (client 30) | `is_active=true`, `cod_agent=NULL` ✅ |

O provisionamento novo (por `client_id`) funcionou — os 3 registros foram criados sem `cod_agent`. **Mas a função `get_sip_credentials` no edge `api4com-proxy` ainda exige `cod_agent`** para buscar o ramal:

```ts
// supabase/functions/api4com-proxy/index.ts (linha 442)
const { data: ext } = await supabase
  .from('phone_extensions')
  .select('api4com_ramal, api4com_password, api4com_id')
  .eq('id', extensionId)
  .eq('cod_agent', codAgent)   // ← falha aqui (codAgent vem '' / null)
  .single();
```

Como `cod_agent` é NULL no ramal e no plano do client_id=30, a query retorna vazio → `Credenciais SIP não encontradas` → SIP nunca registra → ramal fica **offline**.

Há ainda um segundo problema: ao **dial** (linha 126 do mesmo arquivo) também há `.eq('cod_agent', codAgent)` que vai falhar pelo mesmo motivo.

## Correções

### 1. `supabase/functions/api4com-proxy/index.ts`
Substituir os filtros rígidos por `cod_agent` por filtros condicionais usando o helper `scope()` que já existe no topo do arquivo (que já prefere `client_id` quando disponível).

Pontos a corrigir:
- **`get_sip_credentials`** (linha 438-443): trocar `.eq('cod_agent', codAgent)` por `scope()` ou simplesmente remover o filtro — `id` já é único.
- **`dial`** (linha ~126): aplicar `scope()` em vez de filtrar só por `cod_agent`.
- Demais usos de `.eq('cod_agent', codAgent)` (linhas 517, 680, 750) — auditar e converter para `scope()` quando o `client_id` estiver disponível.

### 2. (Opcional, defensivo) `RamalDialog` ao criar ramal
Garantir que ao criar um ramal num client cujos `phone_config`/`phone_user_plans` têm `cod_agent=NULL`, o ramal seja salvo com `cod_agent=NULL` (já é o caso) — sem fallback para um valor inválido.

### 3. Após o deploy
- Recarregar a página `/telefonia` para que o `PhoneContext` refaça `get_sip_credentials`.
- O auto-retry com backoff (já existente em `PhoneContext.tsx`) tentará reconectar automaticamente; ainda assim a recarga acelera o processo.

## Resultado esperado
- O ramal **1015** carrega `api4com_ramal` + `api4com_password` (auto-hidrata via Api4Com se faltar), o softphone registra no SIP `atendejulia.api4com.com:6443` e o status passa para **online/registered**.
- Discagens via `dial` deixam de retornar "Nenhum ramal disponível" para clientes provisionados sem `cod_agent`.
