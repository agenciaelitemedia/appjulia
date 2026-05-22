## Objetivo

Adicionar em `/chat/configuracoes` (aba **Geral**) um novo card que permita habilitar/desabilitar a exibição dos eventos do sistema (badges como "Ana Luiza assumiu a conversa", "reabriu", "adicionou etiqueta", "auto_returned" etc.) na timeline do chat. Os eventos continuam sendo registrados no banco — apenas a visualização passa a respeitar a configuração.

## Comportamento

1. **Card "Eventos da Conversa"** abaixo do card "Retornar Chat automaticamente" em `ChatGeneralSettings.tsx`.
2. **Switch master** "Mostrar eventos no chat":
   - **Desligado** → nenhum evento (`ConversationEvent`) é renderizado na timeline.
   - **Ligado** → abre a lista de eventos individuais (cada um com seu próprio switch).
3. **Lista de eventos individuais** renderizada exatamente como aparece no chat (mesmo componente visual usado em `ConversationEvent` — ícone + label + cor de borda/fundo), cada item com um Switch ao lado.
4. **Tradução de `auto_returned`** → "Sistema devolveu a conversa à fila" (precisa ser adicionado ao mapa `ACTION_LABELS` em `ConversationEvent.tsx`, hoje cai no fallback genérico).
5. **Persistência** no `chat_client_settings.settings` como `event_visibility` (objeto `{ [action]: boolean }`) + `events_enabled` (boolean master). Default: tudo ligado para manter o comportamento atual.

## Eventos suportados (extraídos de `ConversationEvent.tsx`)

| Chave         | Label                       | Cor          |
|---------------|-----------------------------|--------------|
| opened        | abriu a conversa            | emerald      |
| closed        | encerrou a conversa         | muted        |
| resolved      | resolveu a conversa         | blue         |
| reopened      | reabriu a conversa          | amber        |
| assigned      | assumiu / transferiu        | purple       |
| auto_returned | devolveu à fila (novo)      | amber/muted  |
| note_added    | adicionou uma nota          | muted        |
| note_updated  | editou uma nota             | muted        |
| note_deleted  | removeu uma nota            | muted        |
| priority_changed | alterou prioridade       | muted        |
| tag_added     | adicionou etiqueta          | muted        |
| tag_removed   | removeu etiqueta            | muted        |
| won           | marcou como ganho           | muted        |
| lost          | marcou como perdido         | muted        |
| moved         | movimentou o card           | muted        |
| created/updated/archived | demais ações       | muted        |

## Arquivos a alterar

### 1. `src/components/chat/ConversationEvent.tsx`
- Adicionar `auto_returned` em `ACTION_LABELS` ("devolveu a conversa à fila automaticamente") e em `ACTION_ICONS` (ex.: `RotateCcw`).
- Exportar a lista de eventos suportados + um helper `getEventConfigByAction(action)` (sem precisar de uma entry) para que o card de configurações reuse o mesmo render do badge (mesmo ícone, mesma classe de cor, mesma forma). Isso garante "mostre exatamente como aparece no chat".

### 2. `src/hooks/useChatClientSettings.ts`
- Estender a interface com:
  ```ts
  events_enabled: boolean; // master
  event_visibility: Record<string, boolean>; // por ação
  ```
- Defaults: `events_enabled: true`, `event_visibility: {}` (vazio = todos visíveis).

### 3. `src/pages/chat/components/ChatGeneralSettings.tsx`
- Novo card `<ConversationEventsSettingsCard />` abaixo do bloco "Retornar Chat".
- UI:
  - Header com ícone + título "Eventos da Conversa" + Switch master + Badge Ativo/Inativo.
  - Quando ligado, body lista os eventos como mini-cards: badge renderizado exatamente como em `ConversationEvent` (label de exemplo, ex.: "Ana Luiza assumiu a conversa") + Switch à direita.
  - Ações em massa: "Habilitar todos" / "Desabilitar todos".
  - Footer com "Salvar alterações" no mesmo padrão dos outros cards (dirty/saved + botão).

### 4. `src/components/chat/ChatMessages.tsx`
- Antes de mapear `item.kind === 'event'`, consultar `useChatClientSettings`:
  - Se `!settings.events_enabled` → não renderiza nenhum evento.
  - Se ligado → renderiza apenas quando `event_visibility[item.data.action] !== false` (ausência = visível por default).
- Eventos suprimidos não afetam o agrupamento por data (data já vem das mensagens).

## Detalhes técnicos

- Não é necessária migration: tudo persiste em `chat_client_settings.settings` (jsonb).
- A função `getEventConfig` em `ConversationEvent.tsx` precisa ser exportada (ou um helper equivalente) para reuso na tela de configurações — assim os badges renderizam idênticos (mesmo `text-*-600 bg-*-500/10 border-*-500/20`).
- Para o item da lista de eventos no settings, montar `entry` sintético com `actor_name` placeholder (ex.: "Ana Luiza") só para visualização, sem timestamp.
- Filtro no `ChatMessages` é puramente client-side; o backend continua gravando todos os eventos em `chat_conversation_history`.

## Pontos abertos

Nenhum bloqueante. Default = todos os eventos visíveis (preserva comportamento atual).