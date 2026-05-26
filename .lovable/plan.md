## Diagnóstico

Verifiquei a aba **Ambiente & Performance → Dados** (`TelemetryExplorer.tsx`) e os dados no banco:

- Existem **23 usuários** com registros em `user_device_log` (e 315 amostras em `user_performance_log`).
- A view `user_device_latest` está populada corretamente (Mario Castro, Romilda, Ana Carolina, etc.).
- A edge function `telemetry/get_device_latest` está OK.

**O que está acontecendo hoje**: o `TelemetryExplorer` lista **todos os usuários da permissão** (centenas, vindos do CRM externo via `useUsersWithPermissions`). A grande maioria nunca abriu o app depois que a coleta foi ligada, então:

- A lista mostra muita gente sem dado (mostra "Sem dados de acesso ainda" embaixo do nome).
- Ao clicar nos primeiros usuários (que geralmente não têm log), o painel direito aparece com Ambiente vazio ("Este usuário ainda não acessou após a coleta ser ativada"), dando a impressão de que **"não mostra nada de ninguem"**.
- Para usuários que de fato têm log (ex.: Mario Castro id=2), o Ambiente é renderizado normalmente — confirmei no replay/network que o backend devolve o objeto completo.

## Plano

### 1. Edge function `telemetry` — nova action `get_users_with_telemetry`

Adicionar caso que retorna a lista de `user_id`s que possuem registros em `user_device_log` (e opcionalmente último `occurred_at`):

```ts
case 'get_users_with_telemetry': {
  const { data, error } = await admin
    .from('user_device_latest')   // 1 linha por usuário
    .select('user_id, occurred_at');
  if (error) return json({ error: error.message }, 400);
  return json({ data: data ?? [] });
}
```

(Usar a view `user_device_latest` evita varrer toda a tabela e já dá o último acesso por usuário.)

### 2. Hook `useDeviceTelemetry.ts`

Adicionar `useUsersWithTelemetry()` que devolve um `Map<userId, lastOccurredAt>` consumindo essa action, com `staleTime: 60_000`.

### 3. `TelemetryExplorer.tsx` — filtragem da lista

- Chamar `useUsersWithTelemetry()` no topo.
- Antes do filtro de busca/role, manter **apenas** os usuários cujo `id` está no conjunto retornado.
- Ordenar por **último acesso desc** (mais recentes primeiro) para facilitar diagnóstico.
- Mostrar contador no topo: `"X usuários com dados de telemetria"`.
- Se o filtro por role/role + busca esvaziar a lista, manter a mensagem "Nenhum usuário".
- Como agora todo usuário listado tem device, simplificar o fallback "Sem dados de acesso ainda" do `UserRow` (apenas defesa, pode permanecer).
- Auto-selecionar o **primeiro usuário** da lista filtrada (quando nada estiver selecionado) para que o painel da direita já apareça com Ambiente preenchido — resolvendo a impressão de "vazio para todos".

### 4. (Opcional, sem custo extra) Mostrar último acesso no item

Adicionar pequeno texto `há 5 min`, `hoje 14:22` etc. no `UserRow`, vindo do `occurred_at` do mapa — facilita ver quem está ativo.

### Arquivos tocados

- `supabase/functions/telemetry/index.ts` — nova action.
- `src/pages/admin/monitoramento/hooks/useDeviceTelemetry.ts` — novo hook.
- `src/pages/admin/monitoramento/components/TelemetryExplorer.tsx` — filtro + auto-seleção + contador (+ opcional último acesso).

Sem mudanças de schema, sem migrations, sem alterar a aba **Dashboard** nem a aba **Agentes monitorados**.
