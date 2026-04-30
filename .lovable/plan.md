## Diagnóstico

Você comprou telefonia logado como **Mario Castro** (`users.id = 2`, `clients.id = 30`, `business_name = "Escritorio Mario Testes"`).

O pedido foi gravado com `client_id = 2` (e a `phone_config` resultante também). Mas **2 é o ID do usuário, não do cliente** — o ID do cliente "Escritorio Mario Testes" na tabela `clients` é **30**.

Por coincidência, existe um cliente real com `id = 2` (`Alexandre Ferreira`), então a configuração de telefonia que você acabou de pagar foi vinculada por engano ao cliente errado.

### Causa raiz

Em `src/pages/telefonia/contratar/ContratarTelefoniaPage.tsx` (linha 56):

```ts
const { data, error } = await supabase.functions.invoke('telephony-order-create', {
  body: {
    client_id: user.id,   // ❌ user.id é o ID do usuário (2), não do cliente (30)
    ...
  }
});
```

O `AuthContext` expõe dois campos distintos:
- `user.id` — ID do registro em `users` (no seu caso, `2`)
- `user.client_id` — ID do registro em `clients` ao qual o usuário pertence (no seu caso, `30`, hidratado automaticamente para sub-usuários)

A página de contratação está enviando o campo errado.

## Correção

### 1. `src/pages/telefonia/contratar/ContratarTelefoniaPage.tsx`

Trocar `user.id` por `user.client_id` (com fallback explícito + erro claro se ausente):

```ts
const clientId = user?.client_id ?? null;
if (!clientId) {
  toast.error('Não foi possível identificar o cliente vinculado ao seu usuário.');
  return;
}
// ...
body: {
  client_id: clientId,
  ...
}
```

### 2. `supabase/functions/telephony-order-create/index.ts`

Hardening de validação no backend para impedir que esse tipo de mistake aconteça de novo:
- Validar que o `client_id` recebido **existe na tabela `clients`** (via `db-query` interno) antes de criar o pedido. Se não existir, retornar erro 400 claro.
- Manter o campo como numérico (`Number(client_id)`) em vez de `String(client_id)` no insert, para refletir corretamente o tipo da coluna.

### 3. Limpeza dos dados incorretos

A configuração `phone_config id=13` (vinculada por engano ao `client_id=2 / Alexandre Ferreira`) e o pedido `telephony_orders id=deea3a64...` ficaram órfãos/incorretos. Vou:
- Remover a `phone_config` errada (id=13).
- Remover o `phone_user_plans` correspondente (se foi criado).
- Marcar o pedido como `provisioning_error` ou removê-lo (a definir contigo: prefere **apagar o pedido** ou **reprovisionar** apontando para o `client_id=30` correto?).

## O que NÃO vou mexer

- Estrutura do schema (tudo já está correto: `phone_config.client_id` é `bigint`).
- Outros pontos do fluxo (`telephony-provision`, hooks admin) — eles já tratam `client_id` corretamente; o bug está apenas no envio inicial do frontend.

## Decisão necessária

Sobre o pedido bagunçado (Mario / Escritorio Mario Testes, valor R$ 5,00, já pago):
- (a) Apagar o pedido + a config errada e você cria um novo pedido limpo.
- (b) Reaproveitar o pedido existente: corrigir o `client_id` para `30` no pedido + reprovisionar a config no cliente certo, removendo a config errada do `client_id=2`.

Me confirma qual prefere e eu executo junto com a correção do bug.
