# Badges com menu de ação no card do MVP Chat

Cada um dos 4 badges do card passa a exibir uma setinha (chevron) e abrir um menu com ações contextuais. Todo o código novo fica dentro de `src/modules/mvp-chat/` (pasta única do módulo), reaproveitando diálogos já existentes do chat principal.

## Comportamento por badge

### 1. Responsável
- **Aba "Aguardando"**:
  - `Definir Responsável` — abre seletor de responsáveis (mesma lista/busca da equipe usada no chat principal). Se o usuário for owner do client (admin/user/colaborador) pode escolher qualquer membro; se não for, só pode escolher a si mesmo (lista travada no próprio usuário).
  - `Assumir Conversa` — mesma ação já existente: atribui ao usuário atual e move para "Atendimento".
- **Aba "Atendimento"**:
  - `Transferir` (apenas owner) — abre o diálogo de transferência existente.
  - `Devolver para a fila` — remove o responsável e volta a conversa para "Aguardando" (mesma regra do chat principal, com observação opcional).

### 2. Júlia (IA)
- Sem IA vinculada à fila: menu mostra apenas `---`, sem ação.
- Com IA (ativa ou inativa): item `Ir CRM Júlia` — abre o CRM de leads já filtrado pelo telefone do contato.

### 3. CRM Builder
- Sem card vinculado: menu com `---`, sem ação.
- Com card: item `Ir Painel do CRM` — navega direto para o painel/board vinculado, já focando o card do lead.

### 4. Campanha
- Sem campanha: menu com `---`, sem ação.
- Com campanha: item `Ver Campanha` — abre o mesmo diálogo de campanha (Meta Ads) usado no chat principal.

## Detalhes técnicos

**Arquivos novos (todos em `src/modules/mvp-chat/`)**
- `components/MvpBadgeMenu.tsx` — wrapper que envolve o `FixedBadge` num `DropdownMenu`, adiciona o chevron e mantém tooltip; `stopPropagation` no clique para não abrir a conversa.
- `components/MvpAssignDialog.tsx` — "Definir Responsável" usando `TeamMemberSelect` + `useTeamByClient` (já exportados por `extend/ui.ts`), aplicando a regra de owner via `isOwnerUser`/`useIsOwner`.
- `api/mvpChatActions.ts` — mutações do módulo em `chat_conversations` (assign, assumir, devolver para fila) + nota interna opcional, seguindo o padrão de `handleReturnToQueue`/`assignConversation` do chat principal (`assigned_to`, `assigned_user_id`, `status`), com invalidação do feed e das abas.

**Arquivos alterados**
- `components/MvpChatRow.tsx` — passa os 4 badges para `MvpBadgeMenu`, com props de contexto (aba ativa, permissões) e handlers; nenhum estilo/largura de badge é alterado.
- `pages/MvpChatPage.tsx` / `components/MvpChatList.tsx` — repassar a aba ativa até a linha, quando ainda não disponível.
- `extend/ui.ts` — reexportar `DropdownMenu*`, `TransferDialog`, `ReturnToQueueDialog`, `ContactCampaignCard`, `Dialog*` e `isOwnerUser` (apenas reexportação, sem editar componentes existentes).

**Navegações**
- CRM Júlia: `/crm/leads?whatsapp=<telefone>` (parâmetro já suportado por `CRMPage`).
- CRM Builder: `/crm-builder/<boardId>?deal=<dealId>` (padrão já usado em `ChatLinkedDealSheet`).

**Banco (1 migração)**
- Nova versão de `mvp_chat_list_feed` adicionando `crm_board_id` e `crm_deal_id` ao lateral de CRM (hoje só retorna nomes/cores), necessários para a navegação. Nenhuma coluna existente muda; `api/types.ts` recebe os dois campos opcionais.

**Cuidados**
- Menus não disparam a seleção da conversa (propagação bloqueada).
- Sem IA / sem CRM / sem campanha: item `---` desabilitado, mantendo o menu previsível.
- Após cada ação, o feed e o contador da aba são revalidados pelo caminho já existente de invalidação.
