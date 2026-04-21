

## Aba "Grupos" condicional + limpar configurações do Chat

### 1. Mostrar/ocultar aba "Grupos" na sidebar do Chat

**`src/pages/agente/filas/hooks/useAgentQueueLimits.ts`**
- Adicionar `showGroupsTab: boolean` ao tipo `AgentQueueLimits` (default `false`).
- Ler `s.SHOW_GROUPS_TAB` do JSON `settings` da tabela `chat_client_settings`.

**`src/components/chat/ChatList.tsx`**
- Importar `useAgentQueueLimits()`.
- A aba "Grupos" (linha 668–693) só aparece quando `allowGroups === true && showGroupsTab === true`.
- Quando ocultar a aba, renderizar a barra somente com a aba "Individual" (ou esconder todo o bloco toggle, já que sobra apenas uma opção). Vou esconder o bloco inteiro nesse caso para não exibir um toggle inútil.
- Forçar `setActiveTab('individual')` via `useEffect` quando o flag estiver desabilitado e `activeTab === 'groups'`, para evitar tela vazia se o admin desligar a flag enquanto o usuário estiver na aba "Grupos".

### 2. Remover toggles do dialog de configurações

**`src/pages/configuracoes/components/ChatSettingsDialog.tsx`**

No array `ADVANCED_TOGGLES`, remover as 6 entradas:
- `AUTO_ASSIGN_ON_REPLY` — Atribuir ticket ao primeiro a responder
- `BUSINESS_HOURS_BLOCK` — Bloquear envio fora do horário
- `QUICK_REPLIES_ENABLED` — Mensagens rápidas (atalho /)
- `READ_RECEIPTS` — Marcar como lida automaticamente
- `TYPING_INDICATOR` — Indicador "digitando..."
- `SHOW_INTERNAL_NOTES` — Exibir notas internas

Toggles que **permanecem** na seção "Configurações avançadas":
- `SHOW_GROUPS_TAB` — Mostrar aba "Grupos" no chat
- `NOTIFICATION_SOUND` — Som de notificação
- Campos numéricos `AUTO_RESUME_AFTER_HOURS` e `MAX_FILE_SIZE_MB` (mantidos).

**`src/pages/configuracoes/hooks/useChatClientSettings.ts`**
- Manter as chaves removidas no `interface ChatClientSettingsJson` e em `DEFAULT_CHAT_SETTINGS` (compatibilidade com registros já salvos), mas elas deixam de aparecer na UI. Não há remoção de schema necessária (JSONB).

### Resultado

- Aba "Grupos" da sidebar do Chat só aparece quando o cliente tem `ALLOW_GROUPS` **e** `SHOW_GROUPS_TAB` ativados em `/configuracoes → Chat`. Caso contrário, o toggle some completamente e a lista mostra somente conversas individuais.
- Dialog de configurações fica enxuto, com apenas: bloco "Filas" (limite + permitir grupos), e em "Configurações avançadas" os toggles `SHOW_GROUPS_TAB` e `NOTIFICATION_SOUND`, mais os campos numéricos de reabertura de ticket e tamanho de upload.

### Arquivos editados

- `src/pages/agente/filas/hooks/useAgentQueueLimits.ts` — incluir `showGroupsTab`.
- `src/components/chat/ChatList.tsx` — renderização condicional da aba "Grupos" + reset defensivo de `activeTab`.
- `src/pages/configuracoes/components/ChatSettingsDialog.tsx` — remover os 6 toggles solicitados de `ADVANCED_TOGGLES`.

