

## Plano: Web Push + PWA com Push + Módulo de Notificações

### Visão Geral
Implementar notificações push nativas no navegador (Web Push API) integradas ao PWA existente, com um módulo administrativo para criar e enviar notificações manuais para usuários/grupos.

---

### Etapa 1 — Gerar VAPID Keys e armazenar como secrets

Criar uma Edge Function utilitária `generate-vapid-keys` para gerar o par de chaves VAPID (usando a lib `web-push`). A chave pública será exposta no frontend; a privada ficará como secret.

- Adicionar secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (email do remetente)

### Etapa 2 — Tabela `push_subscriptions` (Supabase)

```sql
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id integer NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
-- RLS: allow all (dados internos, sem info sensível exposta)
CREATE POLICY "Allow all on push_subscriptions" ON push_subscriptions FOR ALL USING (true) WITH CHECK (true);
```

### Etapa 3 — Tabela `push_notifications` (Supabase)

Para o módulo admin de criação/gerenciamento de notificações:

```sql
CREATE TABLE push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  icon text,
  url text,
  target_type text NOT NULL DEFAULT 'all', -- 'all', 'role', 'user', 'cod_agent'
  target_value text,
  sent_count integer DEFAULT 0,
  error_count integer DEFAULT 0,
  status text DEFAULT 'draft', -- 'draft', 'sent', 'sending'
  created_by integer,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on push_notifications" ON push_notifications FOR ALL USING (true) WITH CHECK (true);
```

### Etapa 4 — Service Worker (`public/sw.js`)

Arquivo estático que escuta eventos `push` e `notificationclick`:

```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'JulIA', {
      body: data.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      data: { url: data.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
```

### Etapa 5 — Registrar SW e gerenciar subscription no frontend

**Arquivo: `src/lib/pushNotifications.ts`**

- `registerServiceWorker()` — registra `/sw.js` (somente em produção, fora de iframe)
- `subscribeToPush(userId)` — solicita permissão, cria `PushSubscription`, salva no Supabase
- `unsubscribeFromPush(userId)` — remove subscription
- Usa `VITE_VAPID_PUBLIC_KEY` (variável pública no `.env` ou hardcoded)

### Etapa 6 — Componente de Opt-in

**Arquivo: `src/components/notifications/PushNotificationOptIn.tsx`**

- Botão/banner que aparece no layout (ou no perfil) pedindo permissão
- Estados: não suportado, já ativo, pendente, negado
- Integra com `subscribeToPush()` do passo anterior

**Integrar no `MainLayout` ou `Sidebar`** como ícone de sino com badge.

### Etapa 7 — Edge Function `send-push` (envio)

**Arquivo: `supabase/functions/send-push/index.ts`**

- Recebe `{ notificationId }` ou `{ title, body, url, targetType, targetValue }`
- Busca subscriptions filtradas por target (all, role, user, cod_agent)
- Para target `role` ou `cod_agent`, faz query no banco externo via `db-query` para resolver user_ids
- Usa lib `web-push` (npm: `web-push`) com VAPID keys dos secrets
- Atualiza `push_notifications` com `sent_count`, `error_count`, `status`
- Remove subscriptions com `410 Gone` (expiradas)

### Etapa 8 — Módulo Admin "Notificações Push"

**Rota: `/admin/notificacoes-push`** | **Código: `push_notifications`** | **Grupo: SISTEMA**

**Arquivo: `src/pages/admin/push-notifications/PushNotificationsPage.tsx`**

UI com duas abas:

1. **Criar Notificação**
   - Formulário: Título, Corpo, URL (opcional), Ícone (opcional)
   - Target: Todos | Por Role (admin/user/time/advogado/comercial) | Por Usuário | Por Agente (cod_agent)
   - Botão "Enviar Agora" → chama Edge Function `send-push`
   - Botão "Salvar Rascunho"

2. **Histórico**
   - Lista de notificações enviadas com status, contadores, data
   - Filtro por status (draft/sent)
   - Possibilidade de reenviar

**Hook: `useEnsurePushNotificationsModule`** — registra o módulo no menu automaticamente.

### Etapa 9 — Atualizar `manifest.json` para PWA completa

Já está configurado com `display: standalone`. Apenas garantir que `sw.js` seja referenciado corretamente no registro.

### Etapa 10 — Proteção iframe/preview

No `src/main.tsx`, o SW já é desregistrado em preview/iframe. O registro do novo SW será condicionado a **não estar em iframe/preview**, seguindo o guard existente.

---

### Arquivos criados/alterados

| Arquivo | Ação |
|---|---|
| `public/sw.js` | Criar — Service Worker |
| `src/lib/pushNotifications.ts` | Criar — Registro SW + subscription |
| `src/components/notifications/PushNotificationOptIn.tsx` | Criar — UI opt-in |
| `src/pages/admin/push-notifications/PushNotificationsPage.tsx` | Criar — Módulo admin |
| `src/hooks/useEnsurePushNotificationsModule.ts` | Criar — Auto-registro do módulo |
| `supabase/functions/send-push/index.ts` | Criar — Edge Function envio |
| Migração Supabase | `push_subscriptions` + `push_notifications` |
| `src/components/layout/Sidebar.tsx` | Alterar — importar useEnsure |
| `src/App.tsx` | Alterar — rota `/admin/notificacoes-push` |
| `src/main.tsx` | Alterar — registrar SW em produção |

### Recursos necessários
- **3 secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- **2 tabelas Supabase**: `push_subscriptions`, `push_notifications`
- **1 Edge Function**: `send-push`
- **1 Service Worker**: `public/sw.js`

