## Objetivo

Quando, no `/chat`, o usuário clicar no botão CRM de um lead que **já possui card vinculado no CRM Builder**, abrir o **mesmo `DealDetailsSheet`** usado no CRM Builder (com abas Detalhes/Atividade, vínculos, contato, responsável editável, prioridade, tempo na etapa, tags, descrição editável, valor editável, datas), removendo apenas as ações de **Ganho**, **Perdido** e **Excluir/Arquivar**, e mantendo:
- **Fechar** (fecha o sheet)
- **Abrir no CRM** (navega para `/crm-builder/{board_id}?deal={id}`)

Hoje o chat usa um sheet próprio (`ChatLinkedDealSheet`) muito mais enxuto que apenas mostra título, badges, "mover para etapa" e o link da Julia.

## Alterações

### 1. `src/components/deals/DealDetailsSheet.tsx` (componente compartilhado do CRM Builder)

Adicionar props opcionais para customizar o rodapé sem quebrar o uso atual no `BoardPage`:

```ts
interface DealDetailsSheetProps {
  // ...existentes
  hideStatusActions?: boolean;   // esconde Ganho/Perdido (e o Editar quando ativo)
  hideArchiveAction?: boolean;   // esconde o botão Arquivar/Excluir
  footerExtra?: React.ReactNode; // ações adicionais no rodapé (ex.: "Abrir no CRM")
}
```

No JSX do rodapé (linhas ~463–517):
- Envolver o bloco "Ganho/Perdido" com `{!hideStatusActions && deal.status === 'open' && (...)}`.
- Envolver o `Button` "Arquivar/Excluir" com `{!hideArchiveAction && (...)}`.
- Renderizar `{footerExtra}` ao final do rodapé.

Comportamento atual no `BoardPage` permanece idêntico (todas as novas props são opcionais e default `false`/`undefined`).

### 2. `src/hooks/useChatDealLink.ts`

Hoje o hook seleciona apenas um subconjunto de colunas (`id, title, value, currency, priority, status, contact_name, contact_phone, pipeline_id, board_id, custom_fields, board, pipeline`). Para reutilizar o `DealDetailsSheet` completo, expandir o `select` para trazer **todas** as colunas exigidas pelo tipo `CRMDeal`:

```
id, title, description, value, currency, priority, status,
contact_name, contact_phone, contact_email,
assigned_to, tags, expected_close_date,
pipeline_id, board_id, stage_entered_at, created_at, updated_at,
client_id, cod_agent, custom_fields,
board:crm_boards(id,name,color),
pipeline:crm_pipelines(id,name,color)
```

Atualizar a interface `ChatLinkedDeal` para refletir o shape completo (compatível com `CRMDeal` usado pelo Sheet) e manter compatibilidade com os dois consumidores atuais (`ChatCrmButton`, `ChatLinkedDealSheet`).

### 3. `src/components/chat/ChatLinkedDealSheet.tsx` (reescrita enxuta)

Transformar em um wrapper fino sobre o `DealDetailsSheet`:

- Receber `deal: ChatLinkedDeal` (já no shape de `CRMDeal`).
- Buscar o `pipeline` correspondente via `useQuery` (`crm_pipelines` por `board_id`) **ou** simplesmente usar o objeto `deal.pipeline` que já vem aninhado no select (passando-o como `pipeline` para o Sheet — basta normalizar para o formato `CRMPipeline`).
- Implementar `onUpdate` chamando `supabase.from('crm_deals').update(...).eq('id', deal.id)` e, em caso de sucesso, invalidar:
  - `['chat-deal-link', conversationId, clientId]`
  - `['crm-builder-linked-conversations', clientId]`
  - `['crm-deals', boardId]` (best-effort)
- Renderizar:
  ```tsx
  <DealDetailsSheet
    deal={deal as unknown as CRMDeal}
    pipeline={deal.pipeline as any}
    open={open}
    onOpenChange={onOpenChange}
    onEdit={() => {}}        // não usado (hideStatusActions esconde o "Editar" implícito? — o "Editar" só aparece quando !isLinked, e este deal está linkado ao chat, então já fica oculto)
    onArchive={() => {}}     // não usado
    onWon={() => {}}         // não usado
    onLost={() => {}}        // não usado
    onUpdate={handleUpdate}
    hideStatusActions
    hideArchiveAction
    footerExtra={
      <div className="flex gap-2">
        <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>Fechar</Button>
        <Button className="flex-1" onClick={() => {
          onOpenChange(false);
          navigate(`/crm-builder/${deal.board_id}?deal=${deal.id}`);
        }}>
          <ExternalLink className="h-4 w-4 mr-2" /> Abrir no CRM
          <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </div>
    }
  />
  ```

Observação: o botão "Editar" do Sheet já é condicionado a `!isLinked` (onde `isLinked = !!getChatLink(deal) || !!getJuliaLink(deal)`). Como todo deal vindo do chat tem `custom_fields.links.chat`, o botão "Editar" naturalmente fica oculto — sem necessidade de prop adicional.

A funcionalidade que existia no sheet antigo (mover de etapa via `Select`, prévia do lead Julia) **deixa de existir nesse wrapper**, pois o `DealDetailsSheet` completo já oferece edição inline de responsável/descrição/valor e a aba "Atividade" com histórico, cobrindo um conjunto muito mais rico. A movimentação entre etapas continua disponível via "Abrir no CRM".

### 4. Sem alterações em `ChatCrmButton.tsx`

A API do `ChatLinkedDealSheet` (props `open`, `onOpenChange`, `deal`) é mantida — apenas a implementação interna muda.

## Resultado

- Clicar em CRM (badge azul) no header de uma conversa com card vinculado → abre o **mesmo Sheet** do CRM Builder com Detalhes/Atividade, contato, responsável editável, prioridade, tempo na etapa, tags, descrição, valor, datas e timeline de histórico.
- Sem botões **Ganho**, **Perdido** ou **Excluir/Arquivar**.
- Rodapé com **Fechar** e **Abrir no CRM** (navega para o board com o deal aberto).
- Edições inline (responsável, descrição, valor) persistem e atualizam tanto o sheet do chat quanto a lista de conversas e o badge do header (via invalidação de queries).
- Comportamento atual do `BoardPage` permanece inalterado (props novas são opt-in).
