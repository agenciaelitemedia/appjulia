## Objetivo

Remover o botão **IA** (`AIAssistPanel`) do header da conversa e colocar no mesmo lugar um botão **CRM** com ícone + texto, no mesmo estilo (`size="sm" variant="outline" gap-1.5`). O comportamento muda conforme o vínculo da conversa com o CRM Builder:

- **Sem vínculo** → botão branco (outline) → abre Sheet de criação (reaproveita `CreateCrmCardSheet`).
- **Com vínculo** → botão "ativo" (preenchido em azul, igual ao badge `Chat` do DealCard) → abre uma **Sheet lateral nova** mostrando o card vinculado, com possibilidade de mover de pipeline direto pelo chat.

A entrada "Criar Card no CRM" do menu `MoreVertical` (Sparkles) é removida — o acesso passa a ser exclusivamente pelo botão.

## Componentes / arquivos afetados

### 1. `src/components/chat/ChatHeader.tsx`
- Remover `<AIAssistPanel ... />` (linha 467) e seu import.
- Remover o `DropdownMenuItem` "Criar Card no CRM" (linhas 571–575) e o ícone `Sparkles` do import.
- Adicionar novo componente `<ChatCrmButton />` no lugar exato onde estava `AIAssistPanel`, recebendo `conversationId`, `clientId`, `contact`, `codAgent`, `queueId`.
- Remover o estado `showCrmLead` e o uso direto de `CreateCrmCardSheet` (passa para dentro do novo componente).

### 2. Novo: `src/components/chat/ChatCrmButton.tsx`
Encapsula toda a lógica:
- Hook `useChatDealLink(conversationId)` (também novo, abaixo) → retorna `{ deal, isLoading }`.
- Renderiza um único `<Button size="sm" variant="outline">` com ícone `Kanban` (lucide) + texto **"CRM"**:
  - Sem deal → `variant="outline"` (visual branco padrão), texto "CRM".
  - Com deal → `className` extra azul: `bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100` + texto "CRM" + badge sutil com nome da etapa atual (ex.: `CRM · Qualificação`).
- Ao clicar:
  - Sem deal → abre `<CreateCrmCardSheet />` (reaproveitado).
  - Com deal → abre nova `<ChatLinkedDealSheet deal={deal} />`.

### 3. Novo hook: `src/hooks/useChatDealLink.ts`
Busca o `crm_deals` vinculado à conversa atual:
```ts
supabase.from('crm_deals')
  .select('*, board:crm_boards(name), pipeline:crm_pipelines(name,color)')
  .eq('client_id', clientId)
  .contains('custom_fields', { links: { chat: { conversation_id: conversationId } } })
  .eq('status', 'open')
  .maybeSingle()
```
Fallback de query (caso `contains` em json aninhado não funcione bem com o schema atual): consultar `chat_crm_links` por `conversation_id` + `external_system='crm_builder'` para pegar o `board_id`, e depois buscar o deal mais recente daquele board cujo `custom_fields->links->chat->>conversation_id` bata. Manter apenas a abordagem que funcionar — confirmar via teste rápido depois de implementar.
Retorno: `{ deal, board, pipeline, isLoading, refetch }`.
React Query: `staleTime: 30_000`, `enabled: !!conversationId && !!clientId`.

### 4. Novo: `src/components/chat/ChatLinkedDealSheet.tsx`
Sheet lateral à direita (largura `w-[480px] sm:max-w-[480px]`, mesmo padrão do `ContactDetailPanel`). Conteúdo:
- **Header**: avatar/ícone azul `Kanban`, título do deal, badges (board name, pipeline name com cor original do pipeline, `Chat` em azul, e `Julia #id` em roxo se houver — reaproveita estilo do `DealCard`).
- **Bloco "Etapa atual"**: select/dropdown com todos os pipelines do board atual; ao mudar chama `moveDealToPipeline(dealId, fromPipelineId, toPipelineId)` (já existe em `useCRMDeals.ts`, linha ~182). Optimistic update + toast.
- **Bloco "Detalhes"**: valor, prioridade, contato (read-only — edição completa continua em `DealDetailsSheet` no módulo CRM Builder).
- **Bloco "Vínculo Julia"** (se existir): mostra etapa Julia ao vivo via `useJuliaCardPreview` (já existe) com `business_name`, `stage_name` colorida.
- **Ações no rodapé**:
  - Botão **"Abrir no CRM Builder"** → `navigate(\`/crm-builder?deal=\${deal.id}\`)` (ou rota equivalente — verificar `src/pages/crm-builder` ao implementar).
  - Botão **"Ver card Julia"** (se vínculo) → abre `CRMLeadDetailsDialog`.
- **Sem botão de desvincular nem editar** — respeita a regra existente de cards vinculados (memory `builder-card-link-types`).

### 5. Atualização de memória
`mem/features/crm/builder-card-link-types.md`: adicionar seção "Acesso pelo header do chat" descrevendo o botão único `CRM` com dois estados (criar / abrir vinculado) e que a Sheet lateral permite movimentação entre pipelines do mesmo board.

## Decisões de UX

- **Um único botão**, mesmo slot visual do antigo "IA": evita poluir o header.
- **Cor do botão como sinal**: branco = ação (criar), azul = informação viva (já vinculado). Mais rápido de escanear que um ícone com badge.
- **Movimentação inline restrita ao mesmo board**: mover entre boards diferentes é raro e arriscado em um sidebar — fica reservado ao módulo `/crm-builder`.
- **Não mostra histórico/atividade completa**: para isso o usuário usa "Abrir no CRM Builder". A Sheet do chat é foco em "onde está + para onde vai".
- **Reuso máximo**: `CreateCrmCardSheet`, `useJuliaCardPreview`, `moveDealToPipeline`, `CRMLeadDetailsDialog` — sem duplicar lógica.

## Itens fora do escopo

- Editar campos do deal pelo chat (mantém regra: cards vinculados não editáveis pelo módulo Builder também).
- Excluir/arquivar pelo chat.
- Mover entre boards diferentes.
- Recriar funcionalidade IA em outro lugar (o usuário pediu remoção).