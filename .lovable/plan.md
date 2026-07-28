## Plano de ajuste

### Objetivo
Criar um controle claro de permissionamento do CRM Builder com três modos:

- **Desativada**: padrão atual; o quadro aparece e funciona para todos com acesso ao módulo.
- **Perfil**: o quadro aparece somente para o dono/admin e para perfis selecionados.
- **Usuário**: o quadro aparece somente para o dono/admin e para usuários selecionados.

### O que será alterado

1. **Adicionar seletor de modo na aba Permissões**
   - No topo da aba **Permissões**, incluir um controle **Permissão por: Desativada / Perfil / Usuário**.
   - O padrão será **Desativada** para quadros sem configuração.
   - Quando estiver **Desativada**, esconder/desabilitar as tabelas de perfil/usuário e deixar claro que o quadro está aberto para todos.
   - Quando escolher **Perfil**, mostrar somente o bloco “Por perfil”.
   - Quando escolher **Usuário**, mostrar somente o bloco “Por usuário”.

2. **Persistir o modo no próprio quadro**
   - Usar o campo existente `crm_boards.settings` para salvar a flag, sem criar tabela nova:
     - `permission_mode: "disabled" | "role" | "user"`
   - Isso evita migration e reduz risco de quebrar a estrutura atual.

3. **Corrigir a lógica de visibilidade dos quadros**
   - Ajustar a listagem em `/crm-builder` para filtrar os quadros conforme o modo:
     - `disabled`: aparece para todos.
     - `role`: aparece se existir regra para o perfil do usuário com `can_view = true`.
     - `user`: aparece se existir regra para o usuário com `can_view = true`.
     - dono do client_id e admin sempre veem todos.
   - Se um quadro estiver em modo `role` ou `user` sem selecionados com `Ver`, ele ficará visível apenas para dono/admin até configurar corretamente.

4. **Corrigir a permissão efetiva dentro do quadro**
   - Ajustar `useEffectiveBoardPermission` para respeitar o modo salvo:
     - `disabled`: libera ver/criar/editar/remover como hoje.
     - `role`: considera somente regras por perfil.
     - `user`: considera somente regras por usuário.
   - O permissionamento de ações continuará usando as colunas atuais:
     - `can_view`, `can_create`, `can_edit`, `can_delete`.

5. **Resolver o problema de “não consigo clicar”**
   - Verificar e corrigir o componente de checkboxes para garantir que os cliques funcionem, salvem e reflitam imediatamente.
   - Após cada mudança, atualizar a lista em tempo real/cache para não depender de recarregar a página.

6. **Manter compatibilidade**
   - Quadros antigos sem `settings.permission_mode` serão tratados como **Desativada**.
   - As regras já criadas em `crm_board_permissions` não serão apagadas automaticamente; apenas deixam de ser aplicadas quando o modo estiver desativado ou diferente do tipo escolhido.

### Arquivos envolvidos

- `src/pages/crm-builder/BoardSettingsPage.tsx`
- `src/pages/crm-builder/components/settings/permissions/PermissionsManager.tsx`
- `src/pages/crm-builder/hooks/useCRMBoardPermissions.ts`
- `src/pages/crm-builder/hooks/useCRMBoards.ts`
- `src/pages/crm-builder/types.ts`

### Validação

- Abrir `/crm-builder/:boardId/configuracoes` e confirmar que o seletor aparece.
- Testar os três modos:
  - **Desativada**: quadro aparece para todos.
  - **Perfil**: quadro aparece apenas para perfis marcados com `Ver`.
  - **Usuário**: quadro aparece apenas para usuários marcados com `Ver`.
- Confirmar que criar/editar/remover cards segue os checkboxes definidos.
- Confirmar que dono/admin continuam com acesso total.