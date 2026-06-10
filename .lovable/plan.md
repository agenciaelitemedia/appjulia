# Card "Alertas", ícone de som no Header e coluna "Som" na Equipe

## 1. Card "Alertas" na aba Geral (/chat/configuracoes)
Novo card no mesmo padrão visual do card "Retornar Chat automaticamente", com:
- **Switch "Alerta de som para novas mensagens"** — padrão **ativo**. Quando ativo, todos os usuários do client_id têm o alerta sonoro habilitado.
- **Switch "Permitir que usuários da equipe desativem seu próprio alerta"** — habilitado apenas quando o alerta de som está ativo.
- Botão "Salvar alterações" com indicador de alterações não salvas (mesmo padrão do card existente).

Configurações salvas na tabela `chat_client_settings` (campo JSON já existente), com merge que preserva todas as outras chaves:
- `sound_alert_enabled` (padrão `true`)
- `sound_alert_user_can_disable` (padrão `true`)
- `sound_alert_muted_users` — mapa `{ userId: true }` dos usuários que silenciaram o próprio som

## 2. Header: trocar sino por ícone de som
- Remover o ícone de notificação (sino) atual.
- Ícone de som com estados:
  - **Som ativo** (Volume2): alerta do cliente ativo e usuário não silenciado.
  - **Som inativo** (VolumeX, esmaecido): alerta desativado pelo cliente OU silenciado para o usuário.
  - Tooltip explicando o estado atual.
- Clique:
  - Alerta do client_id **desativado** → ícone inativo, não clicável (tooltip: "Alerta de som desativado pelo administrador").
  - Ativo e **permissão = sim** → usuário clica para silenciar/reativar; toast: "Alerta de som ativado" / "Alerta de som desativado".
  - Ativo e **permissão = não** → ícone ativo, não clicável (tooltip: "Seu administrador não permite desativar o alerta").

## 3. Coluna "Som" na /equipe aba Dashboard
- Nova coluna **"Som"** antes da coluna "Chats", para cada membro (incluindo "você"):
  - Ícone Volume2 (ativo) ou VolumeX (inativo), refletindo o estado real do alerta de cada usuário.
  - Clicável: ativa/desativa o som daquele usuário (atualiza `sound_alert_muted_users` no JSON), com toast de confirmação.
  - Se o alerta do cliente estiver desativado nas configurações, todos aparecem como inativos e a coluna fica não clicável (tooltip explicativo).

## 4. Sincronização em Realtime
- Migração mínima: adicionar `chat_client_settings` à publicação Realtime (apenas habilita notificações de mudança — nenhuma alteração de estrutura, dados ou políticas).
- Novo hook compartilhado `useSoundAlertSettings`:
  - Resolve o client_id efetivo (próprio ou herdado do dono do escritório, mesma lógica do som atual)
  - Lê `sound_alert_enabled`, `sound_alert_user_can_disable` e `sound_alert_muted_users`
  - Assina Realtime de `chat_client_settings` do client_id → qualquer alteração (admin desativa o alerta, gestor silencia um usuário na /equipe, usuário silencia no header) reflete **imediatamente** em todas as sessões abertas: header, /equipe e o próprio som.
- `useNewMessageSound` passa a checar antes de tocar: `sound_alert_enabled = true` **e** usuário não está em `sound_alert_muted_users`. Nada mais muda na lógica de Realtime de mensagens/áudio.

## Arquivos afetados
- `src/hooks/useChatClientSettings.ts` — adicionar as 3 novas chaves (com defaults), sem alterar comportamento existente
- `src/hooks/useSoundAlertSettings.ts` — **novo** hook compartilhado (leitura + toggle + realtime)
- `src/hooks/useNewMessageSound.ts` — gate de reprodução
- `src/pages/chat/components/SoundAlertSettingsCard.tsx` — **novo** card de Alertas
- `src/pages/chat/components/ChatGeneralSettings.tsx` — renderizar o novo card
- `src/components/layout/Header.tsx` — remover sino, adicionar ícone de som
- `src/pages/equipe/components/EquipeDashboardTab.tsx` — nova coluna "Som"
- Migração: `ALTER PUBLICATION supabase_realtime ADD TABLE chat_client_settings` (somente habilita realtime)

## Garantias de não-impacto
- Sem mudança de estrutura de tabelas (usa campo JSON existente com merge de chaves)
- Nenhuma alteração no fluxo de mensagens, filas, Realtime do chat ou notificações push
- Padrão "ativo" para todos — ninguém perde o som após o deploy
- Falha na leitura das configurações = comportamento atual mantido (som ativo)
