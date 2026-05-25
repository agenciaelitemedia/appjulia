## Objetivo

Melhorar o módulo de notificações internas com: botão "Testar" (preview local), interpretação de markdown nos toasts, aumento de 50% no tamanho do toast e seleção de tipo de alerta (Informativo/Notificação/Alerta) com cores correspondentes.

## Mudanças

### 1. Banco de dados
Nova migração adicionando coluna `alert_level` em `internal_notifications`:
- `alert_level text not null default 'info'` com valores: `info` | `notice` | `alert`

### 2. Hook `useInternalNotifications.ts`
- Adicionar `AlertLevel = 'info' | 'notice' | 'alert'` ao tipo
- Incluir `alert_level` em `CreateNotificationInput`, `InternalNotification` e no payload de insert

### 3. UI de criação — `CreateNotificationTab.tsx`
- Novo `Select` "Tipo de Alerta" com opções:
  - **Informativo** (azul)
  - **Notificação** (amarelo)
  - **Alerta** (vermelho)
- Novo botão **"Testar"** ao lado de "Enviar agora":
  - Não persiste no banco, não cria recipient, não loga
  - Dispara um item temporário no `NotificationCenter` apenas para o usuário atual via um event bus local (`window.dispatchEvent` de um `CustomEvent('internal-notification:test', { detail: { title, body, type, poll_options, alert_level } })`)

### 4. `NotificationCenter.tsx`
- Escutar o evento `internal-notification:test` e injetar o item no estado `items` com um `recipientId` sintético (prefixo `test-`) que é ignorado em todas as chamadas Supabase (markRead/dismiss/confirm*)
- Aplicar cores conforme `alert_level`:
  - `info`: borda/fundo azul (atual)
  - `notice`: borda/fundo amarelo
  - `alert`: borda/fundo vermelho
- Aumentar tamanho do toast em 50%: largura `w-[510px]` (de 340) e padding/fonte proporcionais (`text-base` no título, `text-[15px]` no corpo)
- O corpo já renderiza markdown via `renderWhatsAppMarkdown` — manter

### 5. Edge function `internal-notification-dispatch`
- Ler `alert_level` da notificação e propagar para `internal_notification_recipients` (opcional — só se quisermos persistir por destinatário; mais simples é o `NotificationCenter` buscar o `alert_level` direto da `internal_notifications` no `addRecipient`, que já faz `select`). **Decisão:** adicionar `alert_level` ao `select` em `addRecipient` — sem mudança no dispatcher.

## Detalhes técnicos

- Mapa de cores (Tailwind, semânticas):
  - `info` → `border-blue-200 bg-blue-50`
  - `notice` → `border-yellow-300 bg-yellow-50`
  - `alert` → `border-red-300 bg-red-50`
- Botão "Testar" é apenas client-side, sem chamadas a Supabase nem invoke do dispatcher
- `recipientId` sintético usa `crypto.randomUUID()` com prefixo `test-`; funções `markRead`, `dismiss`, `confirmPoll`, `confirmAnswer` fazem early-return se id começar com `test-`
- O tipo "test" suporta apenas exibição (botões de poll/question funcionam visualmente mas o "Confirmar" só remove o card local)

## Arquivos afetados

- `supabase/migrations/<novo>.sql` (add column)
- `src/hooks/useInternalNotifications.ts`
- `src/pages/notify-customers/components/CreateNotificationTab.tsx`
- `src/components/notifications/NotificationCenter.tsx`
