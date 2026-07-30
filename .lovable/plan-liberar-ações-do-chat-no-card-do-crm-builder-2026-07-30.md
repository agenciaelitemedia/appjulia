# Liberar ações do chat no card do CRM Builder

## O que está errado hoje

O painel "Conversa do card" decide se é somente-leitura em `BoardChatSidePanel` usando o módulo errado e sem considerar o dono do cliente:

- Usa `chat_admin` (módulo id 60, rota `/admin/chat` — configurações administrativas do chat), quando o módulo que realmente dá acesso ao inbox é `chat` (id 26, rota `/chat`).
- Não faz bypass para dono do client_id (owner) — só para `isAdmin`.
- Ignora o modo de permissão do quadro: bloqueia mesmo quando o permissionamento do CRM está desativado.

Resultado: um usuário que tem o módulo `/chat` na lista dele cai em modo leitura e vê "Você está visualizando esta conversa a partir do CRM...".

## Regra correta

1. Admin ou dono do client_id (owner): acesso total sempre, independente de permissionamento.
2. Permissionamento do quadro desativado: acesso total às ações da conversa.
3. Permissionamento do quadro habilitado (modo Perfil ou Usuário) e usuário não-owner:
   - tem o módulo `chat` nos módulos dele -> ações liberadas (assumir, transferir, encerrar, enviar mensagem e botão "Abrir no Chat");
   - não tem o módulo `chat` -> somente leitura, com o aviso atual.

## Mudanças técnicas

- `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx`
  - Receber o modo de permissão do quadro (`getBoardPermissionMode` sobre o `settings` do board) via prop.
  - Calcular `canWriteChat = isAdmin || isOwnerUser(user) || mode === 'disabled' || hasPermission('chat', 'view')`.
  - Substituir as checagens de `chat_admin` por `chat`.
- `src/pages/crm-builder/BoardPage.tsx`: passar o modo de permissão do quadro para `BoardChatSidePanel` (o board já é carregado ali).
- `ChatSidePanel` não muda — ele apenas reage à prop `readOnly`.

## Verificação

- Owner (`colaborador`/`user` sem parent) em quadro com permissionamento ativo: botão "Abrir no Chat" visível e input habilitado.
- Usuário de equipe com módulo `chat`: ações liberadas.
- Usuário de equipe sem módulo `chat` em quadro com permissionamento ativo: modo leitura com o aviso.