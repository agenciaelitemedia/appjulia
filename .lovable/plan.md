## Ajustes no `DealDetailsSheet.tsx`

Todas as mudanças estão no arquivo `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`. Não precisa alterar `ChatLinkedDealSheet` nem `BoardPage` — eles já consomem este componente.

### 1. Remover botão "Editar" do rodapé
- Remover o botão `Editar` (com ícone `Edit`) da linha de ações.
- A linha do CRM passa a ter apenas **Perdido** e **Ganho**, em `grid-cols-2`, ocupando a largura toda dividida em 2 colunas iguais (cada botão expande na sua coluna via `w-full` implícito do grid).
- Pode-se remover também a verificação `!isLinked` que restringia o botão Editar, e o import de `Edit` do lucide-react.
- A prop `onEdit` continua na interface (para não quebrar callers), mas deixa de ser usada internamente.

### 2. Editar contato inline (Nome, Telefone, E-mail)
No bloco "Contato" (atualmente apenas leitura nas linhas ~307–350):
- Adicionar estados: `editingContact`, `contactDraft` (`{ name, phone, email }`) e incluir `'contact'` no union de `savingField`.
- Adicionar botão lápis (`Pencil`) ao lado do título **Contato** (mesmo padrão usado em "Responsável" e "Descrição"), visível somente quando `onUpdate` existe e não está em modo edição.
- Em modo edição, renderizar três `Input` com labels/ícones (`User`, `Phone`, `Mail`) para `contact_name`, `contact_phone`, `contact_email`, com botões **Salvar** (Check) e **Cancelar** (XIcon).
- `saveContact()` chama `onUpdate({ contact_name, contact_phone, contact_email })` enviando apenas valores trimados (string vazia → `undefined`) e fecha a edição.
- Em modo leitura mantém o layout atual; quando todos os 3 campos estão vazios e `onUpdate` existe, mostrar botão "Adicionar contato" (padrão Plus, igual ao de descrição) que abre o modo edição com drafts vazios.
- Telefone pode usar `maskPhone` de `src/lib/inputMasks.ts` no `onChange` para manter consistência com o resto do app.

### 3. Renomear "Arquivar Deal" → "Arquivar Card"
No botão de arquivar (linha 626) e em qualquer texto associado:
- Trocar o label `'Arquivar Deal'` por `'Arquivar Card'`.
- Para cards vinculados (chat/Julia), trocar `'Excluir card'` → `'Arquivar Card'` (mesma ação, label uniforme).
- Atualizar o `AlertDialog` correspondente:
  - Título: `'Arquivar este card?'` em ambos os casos.
  - Texto do botão de confirmação: `'Arquivar Card'` em ambos os casos.
  - Descrição pode permanecer contextual (linked menciona remoção do vínculo; não-linked menciona restauração em arquivados), mas usando o termo "arquivar" em ambos.

### 4. Layout dos botões Perdido/Ganho
- Continuar usando `grid grid-cols-2 gap-2` na linha de ações (após remover o Editar) para ocupar toda a largura.
- Manter as cores atuais (Perdido com borda destrutiva, Ganho com borda primary).
- Manter `Arquivar Card` como botão full-width na linha logo abaixo (já é `w-full`).

### Comportamento esperado
- **Card comum (CRM)**: rodapé com `[ Perdido | Ganho ]` em uma linha + `[ Arquivar Card ]` full-width abaixo, com dupla confirmação via AlertDialog.
- **Card vinculado (chat)**: continua usando `footerExtra` (Fechar / Abrir no CRM) — sem mudanças.
- **Bloco Contato**: agora editável inline, salvando via `onUpdate` que já está conectado em ambos os contextos (CRM e Chat).