## Objetivo

1. Permitir que `colaborador` use a Notificação Interna como `admin`.
2. Adicionar público **"Minha Equipe"** (donos enviam só para a própria equipe).
3. Na aba **Acompanhar**, clicar na linha dispara um preview via toast (igual ao botão "Testar"), sem salvar nem logar.

## Regras de público por perfil

| Perfil | Públicos disponíveis | Escopo |
|---|---|---|
| admin | Todos, Equipe, Donos de escritório | global |
| colaborador | Todos, Equipe, Donos de escritório | global |
| dono (demais roles) | **Minha Equipe** (somente) | office (filtra por `client_id` do criador) |

"Minha Equipe" = membros com `user_funcao = 'equipe'` cujo `client_id` é o mesmo do dono que criou a notificação.

## Mudanças

### 1. `src/hooks/useInternalNotifications.ts`
- Adicionar `'my_team'` em `NotificationAudience`.
- Helper `canSendGlobal = isAdmin || user?.role === 'colaborador'`.
- No `createAndSend`: `scope = canSendGlobal ? 'global' : 'office'`.
- Listagem: admin e colaborador veem todas; demais veem só as próprias (`created_by`).

### 2. `src/pages/notify-customers/components/CreateNotificationTab.tsx`
- Substituir uso direto de `isAdmin` por `canSendGlobal`.
- Opções do Select "Público":
  - `canSendGlobal`: `all` (Todos), `teams` (Equipe), `owners` (Donos de escritório).
  - Caso contrário (dono): apenas `my_team` (Minha Equipe), default já selecionado.
- Default e reset seguem a mesma regra.

### 3. `src/pages/notify-customers/components/NotificationsListTab.tsx`
- Tornar cada linha clicável (`cursor-pointer`, hover destacado, `role="button"`).
- Ao clicar: disparar `window.dispatchEvent(new CustomEvent('internal-notification:test', { detail: { title, body, type, poll_options, alert_level } }))` — exatamente o mesmo evento já consumido pelo `NotificationCenter`, que injeta um item com prefixo `test-` (não persiste, não loga).
- Evitar disparo quando o clique vier de um botão de ação interna da linha (usar `event.stopPropagation()` nesses botões, se houver).

### 4. `supabase/functions/internal-notification-dispatch/index.ts`
- Aceitar `n.audience === 'my_team'`:
  - Filtro `user_funcao = 'equipe'` + restrição ao `client_id` do criador (mesma lógica do `scope = 'office'`, aplicada independentemente do `scope`).
- Demais audiences (`all`, `teams`, `owners`) permanecem inalterados.

### 5. Migration
- Atualizar o `CHECK` da coluna `audience` em `internal_notifications` para permitir `'my_team'`.

```sql
ALTER TABLE public.internal_notifications
  DROP CONSTRAINT IF EXISTS internal_notifications_audience_check;
ALTER TABLE public.internal_notifications
  ADD CONSTRAINT internal_notifications_audience_check
  CHECK (audience IN ('all','owners','teams','my_team'));
```

## Fora de escopo
- Visual do toast, markdown e `alert_level` (já implementados).
- Nenhuma escrita em DB ao clicar para preview.

## Verificação
- `colaborador`: 3 opções globais e disparo OK.
- `dono`: apenas "Minha Equipe"; disparo atinge somente `equipe` com mesmo `client_id`.
- `admin`: comportamento inalterado.
- Aba Acompanhar: clicar em qualquer linha exibe o toast de preview sem persistir nada.
