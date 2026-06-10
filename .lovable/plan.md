# Restringir acesso ao Studio da Central de Ajuda

## O que muda

O Studio (`/ajuda/studio`) passa a ser acessível **somente** para:
1. Usuários com perfil **admin**
2. Usuários **vinculados manualmente** na nova aba **"Permissões"** dentro do Studio

A permissão genérica de "edição" do módulo deixa de liberar o Studio. A Central de Ajuda (`/ajuda`) continua visível para todos com acesso ao módulo.

## Nova aba "Permissões" (visível apenas para admin)

Seguindo o layout da tela de referência (Vincular Usuário):
- Campo de busca "Buscar usuário por nome ou email..." com resultados em tempo real (mesma busca usada no cadastro de agentes)
- Ao clicar em um resultado, o usuário é vinculado como editor do Studio
- Lista dos usuários vinculados em cards, com nome, email e botão para remover o vínculo
- Estado vazio ilustrado quando não há busca/vínculos

## Comportamento de acesso

- O botão "Studio" na página `/ajuda` aparece apenas para admin ou usuários vinculados
- As rotas `/ajuda/studio` e `/ajuda/studio/post/:id` ganham uma guarda própria: quem não for admin nem vinculado é redirecionado para `/ajuda`
- A aba "Permissões" só aparece para admin (usuários vinculados veem Posts, Categorias e Destaques, mas não gerenciam permissões)

## Detalhes técnicos

1. **Migração de banco** — nova tabela `help_studio_editors`:
   - `user_id` (bigint, único), `user_name`, `user_email`, `added_by` (bigint), `created_at`
   - GRANTs e política seguindo o padrão das demais tabelas do Help Center
2. **Hook `useHelpStudioAccess`** — retorna `canAccessStudio` (admin OU id presente em `help_studio_editors`) com React Query
3. **Guarda `HelpStudioGuard`** — componente que envolve as rotas do Studio no `App.tsx`, redirecionando para `/ajuda` sem acesso
4. **Aba `HelpPermissionsTab`** — busca via `externalDb.searchUsers` (debounce 300ms, mínimo 3 caracteres), inserção/remoção na tabela com invalidação de cache
5. **Ajustes** — `HelpCenterPage.tsx` troca `isAdmin || canEdit('help_center')` pelo novo hook; `HelpStudioPage.tsx` adiciona a aba condicional

## Arquivos

- Nova migração SQL (`help_studio_editors`)
- `src/hooks/useHelpStudioAccess.ts` (novo)
- `src/pages/ajuda/studio/components/HelpPermissionsTab.tsx` (novo)
- `src/pages/ajuda/studio/HelpStudioPage.tsx`, `src/pages/ajuda/HelpCenterPage.tsx`, `src/App.tsx` (editados)
