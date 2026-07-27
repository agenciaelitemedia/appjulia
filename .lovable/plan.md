## Objetivo

Ao clicar em **Configurações** no menu (⋯) do card do quadro, navegar para uma **página dedicada de configurações do quadro** (não mais o Sheet lateral do board), contendo duas abas:

- **Geral** — vazia por enquanto (placeholder).
- **Permissões** — funcionalidade completa de permissionamento por perfil e por usuário (como já implementado no componente `PermissionsManager`), visível/gerenciável apenas para o dono do client ou admin.

## Rota nova

Criar rota `/crm-builder/:boardId/configuracoes` que renderiza um novo componente `BoardSettingsPage`. É uma página real (com header e voltar), não um sheet.

O menu "Configurações" do `BoardCard` passa a navegar para essa rota diretamente (sem query param). O clique no próprio card continua indo para `/crm-builder/:boardId` (kanban do board), sem mudança.

## Estrutura da página

```text
┌───────────────────────────────────────────────────┐
│  ← Voltar    Configurações: <nome do quadro>      │
├───────────────────────────────────────────────────┤
│  [ Geral ]  [ Permissões ]                        │
├───────────────────────────────────────────────────┤
│  <conteúdo da aba selecionada>                    │
└───────────────────────────────────────────────────┘
```

- **Aba Geral**: card vazio com mensagem "Em breve: cores, ícone, arquivar quadro" (mesmo placeholder que já existe no Sheet).
- **Aba Permissões**: reutiliza o componente já pronto `PermissionsManager` (`src/pages/crm-builder/components/settings/permissions/PermissionsManager.tsx`) com as sub-abas "Por perfil" / "Por usuário" e o CRUD completo já implementado. Se o usuário não for dono/admin, essa aba fica desabilitada e mostra um estado "Você não tem permissão para gerenciar permissões deste quadro".

Comportamento de acesso:
- Se `boardId` não existir ou o quadro não pertencer ao `client_id` atual → redireciona para `/crm-builder`.
- Aba padrão: `permissions` para dono/admin, senão `general`.

## Arquivos a criar / alterar

1. **Novo**: `src/pages/crm-builder/BoardSettingsPage.tsx`
   - Header com botão voltar (navega para `/crm-builder/:boardId`).
   - Fetch do quadro (mesmo padrão de `BoardPage`) só para exibir o nome e validar o `client_id`.
   - `Tabs` shadcn com `general` e `permissions`.
   - Usa `useIsBoardOwner` para condicionalizar a aba Permissões.

2. **Alterar**: `src/App.tsx` (ou o arquivo do router principal do CRM Builder)
   - Registrar a rota `/crm-builder/:boardId/configuracoes` apontando para `BoardSettingsPage`, protegida pelo mesmo `ProtectedRoute` que já cobre `/crm-builder`.

3. **Alterar**: `src/pages/crm-builder/CRMBuilderPage.tsx`
   - `handleBoardSettings` deixa de navegar para `?settings=permissions` e passa a navegar para `/crm-builder/${board.id}/configuracoes`.

4. **Alterar**: `src/pages/crm-builder/BoardPage.tsx`
   - Remover o `useEffect` que lia `?settings=permissions` e o estado `settingsInitialTab` — não são mais necessários.
   - O botão "Configurações" dentro do próprio board (header do kanban) também passa a navegar para `/crm-builder/:boardId/configuracoes` em vez de abrir o `BoardSettingsSheet`.
   - O `BoardSettingsSheet` pode continuar existindo para futuras funcionalidades in-line, mas deixa de ser aberto pela ação de configurações do card. (Alternativa: remover a montagem do Sheet em `BoardPage`; decisão: **manter o Sheet montado apenas se ainda houver outro gatilho**; hoje só tinha esse — então removemos a montagem para eliminar código morto.)

5. **Manter sem alteração**:
   - `PermissionsManager.tsx`
   - `useCRMBoardPermissions.ts` (`useIsBoardOwner`, `useBoardPermissions`, `useEffectiveBoardPermission`)
   - Tabela `crm_board_permissions` e todas as policies/grants existentes.
   - `BoardCard.tsx` / `BoardGrid.tsx` — o wiring `onSettings` já existe, só muda o destino no `CRMBuilderPage`.

## Verificação

- Clicar em **⋯ → Configurações** em qualquer card do CRM Builder abre `/crm-builder/:id/configuracoes` com a aba **Permissões** ativa (para dono/admin).
- Editar checkboxes por perfil/usuário salva na tabela `crm_board_permissions` (comportamento inalterado).
- Voltar retorna para `/crm-builder/:id` (board Kanban).
- Não-owner ao navegar diretamente para a URL vê a aba Geral vazia e Permissões desabilitada.

## Fora de escopo

- Conteúdo real da aba Geral (cores, ícone, arquivar) — fica como placeholder.
- Alterações no schema de permissões.
- Migrar outras abas do `BoardSettingsSheet` (Analytics, Campos, Automações, Auditoria) para a página nova — permanecem acessíveis pelo botão "Configurações" dentro do próprio board (kanban), se ainda existir; se preferir consolidar tudo em uma página só, é um passo posterior.
