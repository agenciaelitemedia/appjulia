## Objetivo
Exibir no histórico de chamadas Wavoip o usuário responsável pela ligação — tanto quem discou (saída) quanto quem atendeu (entrada).

## Situação atual
- `wavoip_call_logs.app_user_id` já é gravado:
  - **Saída**: pelo `WavoipContext` no momento em que o usuário confirma a discagem (`app_user_id: user?.id`).
  - **Entrada**: pelo webhook `wavoip-call-webhook`, que resolve `app_user_id` a partir do `wavoip_devices` que recebeu o evento (dono do dispositivo que atendeu/tocou).
- A coluna `app_user_id` já vem no hook `useWavoipCallHistory`, mas **não é exibida** em `CallHistoryTab.tsx`.
- Já existe `useTeamByClient()` que retorna `{ id, name }` da equipe do cliente.

## Alterações

### `src/pages/wavoip/components/CallHistoryTab.tsx`
1. Consumir `useTeamByClient()` e montar um `Record<number, string>` (id → nome).
2. Adicionar coluna **"Usuário"** na tabela, entre "Dispositivo" e "Número discado":
   - Rótulo do cabeçalho muda conforme a linha? Não — mantemos um único cabeçalho "Usuário"; o `Tipo` na mesma linha já indica se é entrada/saída, então fica claro se o usuário mostrado discou ou atendeu.
   - Valor: `teamMap[c.app_user_id] ?? '—'`.
   - Ícone: `User` (lucide) para consistência visual com os demais campos.
3. Sem alterações no schema nem em edge functions — o dado já é persistido corretamente hoje.

### Fora de escopo
- Backfill de registros antigos sem `app_user_id`: os novos serão gravados normalmente; registros antigos aparecerão como "—".
- Nenhuma mudança em webhooks, contexto ou banco.
