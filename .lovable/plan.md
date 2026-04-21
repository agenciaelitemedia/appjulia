## Módulo Contatos (SISTEMA)

Criar novo módulo `contacts` na categoria SISTEMA com gerenciamento de contatos sincronizados pelo chat (`chat_contacts`).

### Estrutura

**Rota:** `/contatos`  
**Código de permissão:** `contacts`  
**Grupo de menu:** SISTEMA  
**Ícone:** `Users` (Lucide)  
**Display order:** 75 (logo após Mensagens Rápidas)

### UI / Layout

```text
┌─────────────────────────────────────────────────────────┐
│ Contatos                      [🔍 Buscar nome/telefone] │
├─────────────────────────────────────────────────────────┤
│ [ Contatos (1.234) ] [ Grupos (56) ]                    │
├─────────────────────────────────────────────────────────┤
│ Avatar │ Nome           │ Telefone     │ Última msg │ ⚙ │
│  🟢    │ João Silva     │ 5511999...   │ 2h atrás   │...│
│  🟢    │ Maria          │ 5511988...   │ ontem      │...│
└─────────────────────────────────────────────────────────┘
```

**Tabela**:  

- Colunas: Avatar, Nome, Telefone, Fila (channel_source), Última mensagem (last_message_at), Ações.  
- Paginação de 50 itens (igual padrão chat).  
- Busca por nome ou telefone (filtro client-side com debounce).

**Abas (Tabs)**:

- **Contatos** → `is_group = false`
- **Grupos** → `is_group = true`  
Contadores por aba ao lado do título.

### Ações por linha (menu `⋯` + tooltips)

1. **Abrir Chat** (ícone `MessageCircle` verde) → `navigate('/chat')` + persiste o `contactId` em `sessionStorage` (`chat_pending_contact_id`); o `ChatPage` lê e dispara `selectContact(id)` automaticamente ao montar.
2. **Editar** (ícone `Pencil` azul) → abre `Dialog` com formulário (nome, telefone, avatar URL). Salva via `supabase.from('chat_contacts').update(...)`.
3. **Excluir** (ícone `Trash2` vermelho) → padrão de **dupla confirmação** (mem: `secure-deletion-workflow`):
  - `AlertDialog` exigindo digitar o telefone exato do contato.
  - Após confirmação: deleta `chat_messages`, `chat_conversations` vinculadas, depois o registro em `chat_contacts`.
  - Toast de sucesso + invalidate query.

### Arquivos a criar

- `src/pages/contatos/ContatosPage.tsx` — página com Tabs e tabela.
- `src/pages/contatos/components/ContactsTable.tsx` — tabela + ações.
- `src/pages/contatos/components/EditContactDialog.tsx` — modal edição.
- `src/pages/contatos/components/DeleteContactDialog.tsx` — dupla confirmação.
- `src/pages/contatos/hooks/useContactsList.ts` — React Query (filtra `is_group`, busca, paginação).
- `src/hooks/useEnsureContactsModule.ts` — auto-cria/atualiza módulo no menu (igual aos outros `useEnsure*`).

### Arquivos a editar

- `src/types/permissions.ts` — adicionar `'contacts'` ao `ModuleCode`.
- `src/App.tsx` — importar `ContatosPage` e adicionar rota `/contatos` com `ProtectedRoute module="contacts"`.
- `src/components/layout/Sidebar.tsx` — chamar `useEnsureContactsModule()`.
- `src/pages/chat/ChatPage.tsx` — no `useEffect`, ler `sessionStorage.getItem('chat_pending_contact_id')`, chamar `selectContact(id)` após `loadContacts`, depois remover a chave.

### Detalhes técnicos

- Query: `supabase.from('chat_contacts').select('*').eq('client_id', clientId).eq('is_group', tab === 'groups').order('last_message_at', { ascending: false })`.
- Permissões padrão: admin tem acesso total; demais usuários precisam de `contacts.view/edit/delete` configurado em `/admin/permissoes`.
- Sem alterações de schema — a tabela `chat_contacts` já existe com todos os campos necessários.