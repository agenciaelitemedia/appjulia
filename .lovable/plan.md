## Objetivo

Adicionar, no topo do `DealDetailsSheet` (logo **antes** das abas "Detalhes / Atividade"), um bloco **Etapas** que mostra a etapa atual e um botão para expandir/recolher. Quando expandido, exibe **uma lista de cards (um por linha)** com todas as etapas do board — cada linha mostra a bolinha colorida + nome da etapa, é clicável e move o deal para aquela etapa imediatamente.

Funciona tanto no CRM Builder quanto no chat (via `ChatLinkedDealSheet`).

---

## 1. `DealDetailsSheet.tsx` — novo bloco "Etapas"

Arquivo: `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

### 1.1 Novas props
```ts
/** Lista completa de etapas (pipelines) do board para permitir mover */
stages?: CRMPipeline[];
/** Callback quando o usuário clica numa etapa diferente da atual */
onMoveToStage?: (stageId: string) => Promise<boolean> | boolean | void;
```

Mantém o componente retrocompatível: se `stages` ou `onMoveToStage` não forem passados, o bloco não é renderizado.

### 1.2 UI do bloco (renderizado entre `SheetHeader` e `<Tabs>`)

- Container com `border-b px-6 py-3` para se integrar visualmente ao header.
- Linha "resumo" sempre visível:
  - Esquerda: rótulo `Etapa` (texto pequeno) + badge da etapa atual (bolinha colorida `pipeline.color` + nome).
  - Direita: botão fantasma `Editar` com ícone `ChevronDown`/`ChevronUp` que alterna o estado `expanded`.
- Quando `expanded === true`, abaixo do resumo, lista vertical (`space-y-1.5 mt-3`) com **um card por linha** para cada `stage` em `stages` (ordenadas por `position`):
  - Card: `flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors w-full text-left`.
  - A etapa atual recebe destaque: `border-primary/40 bg-primary/5` + ícone `Check` à direita.
  - Conteúdo: `<span className="h-3 w-3 rounded-full" style={{ backgroundColor: stage.color }} />` + `<span className="text-sm">{stage.name}</span>`.
- Estado local: `const [expanded, setExpanded] = useState(false);` e `const [movingTo, setMovingTo] = useState<string | null>(null);` para mostrar `Loader2` na linha clicada e desabilitar cliques durante o save.

### 1.3 Handler de clique
```ts
const handleStageClick = async (stageId: string) => {
  if (!onMoveToStage || stageId === deal.pipeline_id || movingTo) return;
  setMovingTo(stageId);
  try {
    await onMoveToStage(stageId);
    setExpanded(false);
  } finally {
    setMovingTo(null);
  }
};
```

### 1.4 Importações novas
- `ChevronDown`, `ChevronUp`, `Check`, `Loader2` de `lucide-react`.

---

## 2. CRM Builder — passar `stages` e `onMoveToStage`

Procurar onde `DealDetailsSheet` é instanciado no board (provavelmente em `src/pages/crm-builder/CRMBuilder.tsx` ou `components/board/...`) e:

1. Passar a lista de pipelines do board atual como `stages={pipelines}` (já obtida via `useCRMPipelines`).
2. Passar `onMoveToStage={(stageId) => moveDeal({ dealId: deal.id, fromPipelineId: deal.pipeline_id, toPipelineId: stageId, newPosition: 0 })}` reaproveitando o `moveDeal` existente em `useCRMDeals`. Isso garante que o histórico (`recordHistory(... 'moved' ...)`) seja registrado e o `stage_entered_at` resetado, exatamente como acontece no drag-and-drop.

> Nota: `moveDeal` hoje recebe um `DropResult`. Vou apenas montar esse objeto no callback — sem alterar a assinatura da função.

---

## 3. `ChatLinkedDealSheet.tsx` — habilitar mover etapas a partir do chat

Arquivo: `src/components/chat/ChatLinkedDealSheet.tsx`

1. Buscar as etapas do board do deal (sem precisar abrir o board inteiro):
   ```ts
   const { data: stages = [] } = useQuery({
     queryKey: ['crm-builder-board-pipelines', deal.board_id],
     enabled: open && !!deal.board_id,
     queryFn: async () => {
       const { data, error } = await supabase
         .from('crm_pipelines')
         .select('*')
         .eq('board_id', deal.board_id)
         .eq('is_active', true)
         .order('position', { ascending: true });
       if (error) throw error;
       return (data || []) as CRMPipeline[];
     },
   });
   ```
2. Implementar `handleMoveToStage`:
   ```ts
   const handleMoveToStage = async (stageId: string) => {
     const { error } = await supabase
       .from('crm_deals')
       .update({
         pipeline_id: stageId,
         stage_entered_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
       })
       .eq('id', deal.id);
     if (error) { toast.error('Erro ao mover etapa'); return false; }
     // Registra no histórico (mesma tabela usada pelo moveDeal do board)
     await supabase.from('crm_deal_history').insert({
       deal_id: deal.id,
       action: 'moved',
       from_pipeline_id: deal.pipeline_id,
       to_pipeline_id: stageId,
     });
     toast.success('Etapa atualizada');
     await queryClient.invalidateQueries({ queryKey: ['chat-deal-link'] });
     await queryClient.invalidateQueries({ queryKey: ['crm-builder-linked-conversations', clientId] });
     await queryClient.invalidateQueries({ queryKey: ['crm-deals', deal.board_id] });
     onMoved?.();
     return true;
   };
   ```
   > Vou inspecionar `useCRMDealHistory`/`recordHistory` para usar exatamente o mesmo formato (provavelmente inclui `created_by`/`changed_by`) e evitar divergência com o board.
3. Passar `stages={stages}` e `onMoveToStage={handleMoveToStage}` para o `DealDetailsSheet`.

---

## 4. Comportamento esperado (resumo)

- **Recolhido** (estado padrão ao abrir): mostra apenas a etapa atual + botão "Editar".
- **Expandido**: lista vertical de todas as etapas do board, uma por linha, com bolinha colorida + nome.
  - Etapa atual em destaque (não clicável de fato; clique é ignorado).
  - Demais etapas clicáveis: ao clicar, exibe `Loader2` na linha, persiste no banco, fecha o expand e o badge da etapa no resumo já reflete a mudança (via invalidação de cache + atualização vinda do `onUpdate`/refetch do hook pai).
- **CRM badge na lista de conversas e header do chat**: já são atualizados via as queries `chat-deal-link` e `crm-builder-linked-conversations` que invalidamos.

---

## Arquivos a editar

- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` — adicionar bloco Etapas e props.
- `src/pages/crm-builder/CRMBuilder.tsx` (ou onde `DealDetailsSheet` é renderizado no board) — passar `stages` e `onMoveToStage` reaproveitando `moveDeal`.
- `src/components/chat/ChatLinkedDealSheet.tsx` — buscar pipelines do board, implementar `handleMoveToStage` e repassar para o sheet.
