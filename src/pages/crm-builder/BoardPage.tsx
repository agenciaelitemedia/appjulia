import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { 
  ArrowLeft,
  Plus,
  RefreshCw,
  Settings2,
} from 'lucide-react';
import { PipelineColumn } from './components/pipeline/PipelineColumn';
import { CreatePipelineDialog } from './components/pipeline/CreatePipelineDialog';
import { DealCard } from './components/deals/DealCard';
import { CreateDealDialog } from './components/deals/CreateDealDialog';
import { DealDetailsSheet } from './components/deals/DealDetailsSheet';
import { BoardChatSidePanel } from './components/deals/BoardChatSidePanel';
import { BoardFilters, type BoardFiltersState } from './components/filters/BoardFilters';
import { BoardSettingsSheet } from './components/settings/BoardSettingsSheet';
import { useCRMPipelines } from './hooks/useCRMPipelines';
import { useCRMDeals } from './hooks/useCRMDeals';
import { useCRMCustomFields } from './hooks/useCRMCustomFields';
import { useCRMBoards } from './hooks/useCRMBoards';
import { useMoveDealToBoard } from './hooks/useMoveDealToBoard';
import { toast } from 'sonner';
import type { CRMBoard, CRMPipeline, CRMDeal, CRMPipelineFormData, CRMDealFormData } from './types';
import { CRMScrollNavigation } from '@/pages/crm/components/CRMScrollNavigation';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const codAgent = user?.cod_agent?.toString() || '';
  const clientId = user?.client_id ? String(user.client_id) : '';
  const canManage = user?.role === 'user' || user?.role === 'admin' || user?.role === 'colaborador';

  // Board state
  const [board, setBoard] = useState<CRMBoard | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);

  // Pipelines
  const {
    pipelines,
    isLoading: isLoadingPipelines,
    createPipeline,
    updatePipeline,
    deletePipeline,
    reorderPipelines,
  } = useCRMPipelines({ boardId: boardId || null, clientId, codAgent, canManage });

  // Deals
  const {
    deals,
    isLoading: isLoadingDeals,
    getDealsByPipeline,
    createDeal,
    updateDeal,
    moveDeal,
    previewMove,
    setDealStatus,
    archiveDeal,
    fetchDeals,
  } = useCRMDeals({ boardId: boardId || null, clientId, codAgent, userName: user?.name });

  // Custom Fields
  const { fields: customFields } = useCRMCustomFields({ boardId: boardId || null, clientId, codAgent, canManage });

  // Lista de quadros disponíveis (para mover card entre quadros)
  const { boards: allBoards } = useCRMBoards({ clientId, codAgent, canManage });
  const moveDealToBoard = useMoveDealToBoard();

  // Filters state
  const [filters, setFilters] = useState<BoardFiltersState>({
    search: '',
    myCards: false,
    priorities: [],
    statuses: [],
    pipelineIds: [],
    assignedTo: [],
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dialog states
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<CRMPipeline | null>(null);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [selectedPipelineForDeal, setSelectedPipelineForDeal] = useState<CRMPipeline | null>(null);
  const [editingDeal, setEditingDeal] = useState<CRMDeal | null>(null);
  const [viewingDeal, setViewingDeal] = useState<CRMDeal | null>(null);
  const [chatPanelDeal, setChatPanelDeal] = useState<CRMDeal | null>(null);

  // Mantém o viewingDeal sincronizado com a lista (para refletir updates como prioridade)
  useEffect(() => {
    if (!viewingDeal) return;
    const fresh = deals.find(d => d.id === viewingDeal.id);
    if (fresh && fresh !== viewingDeal) {
      setViewingDeal(fresh);
    }
  }, [deals, viewingDeal]);

  // DnD state
  const [activeDeal, setActiveDeal] = useState<CRMDeal | null>(null);
  // Pipeline de origem capturado no início do drag (antes do preview mover).
  const dragOriginPipelineRef = useRef<string | null>(null);
  // Destino calculado pelo onDragOver — fonte única da verdade no commit
  // final (evita ler `deals` que pode estar atrasado por re-render).
  const dragPreviewRef = useRef<{
    dealId: string;
    toPipelineId: string;
    toIndex: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Scroll ref for custom navigation
  const scrollRef = useRef<HTMLDivElement>(null);

  // Unique assignees for filter dropdown
  const assignees = useMemo(() => {
    const names = deals
      .map((d) => d.assigned_to)
      .filter((n): n is string => !!n);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [deals]);

  // Filter deals
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch = 
          deal.title.toLowerCase().includes(searchLower) ||
          deal.contact_name?.toLowerCase().includes(searchLower) ||
          deal.contact_phone?.toLowerCase().includes(searchLower) ||
          deal.contact_email?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Priority filter
      if (filters.priorities.length > 0 && !filters.priorities.includes(deal.priority)) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !filters.statuses.includes(deal.status)) {
        return false;
      }

      // Pipeline filter
      if (filters.pipelineIds.length > 0 && !filters.pipelineIds.includes(deal.pipeline_id)) {
        return false;
      }

      // Assignee filter
      if (filters.assignedTo.length > 0 && !filters.assignedTo.includes(deal.assigned_to ?? '')) {
        return false;
      }

      // My cards filter
      if (filters.myCards && user?.name && deal.assigned_to !== user.name) {
        return false;
      }

      return true;
    });
  }, [deals, filters, user?.name]);

  // Get filtered deals by pipeline
  const getFilteredDealsByPipeline = useCallback((pipelineId: string) => {
    return filteredDeals
      .filter(deal => deal.pipeline_id === pipelineId)
      .sort((a, b) => a.position - b.position);
  }, [filteredDeals]);

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Hybrid collision detection: prioritizes pointer position so dropping
  // anywhere over a column (including empty space / lateral area) targets
  // that column. Falls back to nearest deal/column otherwise.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = String(args.active.id);
    // Pipeline reordering: keep default behavior between pipeline sortables
    if (activeId.startsWith('pipeline-')) {
      return closestCenter(args);
    }

    // Deal drag — colisão contextual:
    //  - Mesma coluna do card arrastado: priorizar `deal-*` (reordenação fina).
    //  - Coluna diferente: se cursor está nos 40% inferiores de um card OU se há
    //    coluna sob o cursor, priorizar a coluna (drop no fim). Caso contrário,
    //    usar o card (insere antes dele).
    const dealId = activeId.replace('deal-', '');
    const activeDealRef = deals.find((d) => d.id === dealId);
    const activePipelineId = activeDealRef?.pipeline_id ?? null;

    const pointerCollisions = pointerWithin(args);
    const dealCollisions = pointerCollisions.filter((c) =>
      String(c.id).startsWith('deal-')
    );
    const columnCollisions = pointerCollisions.filter((c) =>
      String(c.id).startsWith('pipeline-drop-')
    );

    if (dealCollisions.length > 0) {
      const firstDealId = String(dealCollisions[0].id).replace('deal-', '');
      const overDeal = deals.find((d) => d.id === firstDealId);
      const sameColumn =
        overDeal && activePipelineId && overDeal.pipeline_id === activePipelineId;

      if (sameColumn) {
        // Reordenação fina dentro da própria coluna
        return closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((d) =>
            String(d.id).startsWith('deal-')
          ),
        });
      }

      // Coluna diferente: verificar se o cursor está na metade inferior do card
      // -> nesse caso, preferir a COLUNA (insere ao final / abaixo).
      const pointerY = (args.pointerCoordinates?.y ?? 0);
      const overRect = (dealCollisions[0].data?.droppableContainer as { rect: { current: { top: number; height: number } | null } } | undefined)?.rect.current;
      const inLowerHalf = overRect
        ? pointerY > overRect.top + overRect.height * 0.6
        : false;

      if (inLowerHalf && columnCollisions.length > 0) {
        return columnCollisions;
      }
      return dealCollisions;
    }

    if (columnCollisions.length > 0) {
      return columnCollisions;
    }
    // Last resort: rect intersection across everything
    const rectCollisions = rectIntersection(args);
    if (rectCollisions.length > 0) return rectCollisions;
    return closestCorners(args);
  }, [deals]);

  // Fetch board
  const fetchBoard = useCallback(async () => {
    if (!boardId) return;
    
    setIsLoadingBoard(true);
    try {
      const { data, error } = await supabase
        .from('crm_boards')
        .select('*')
        .eq('id', boardId)
        .maybeSingle();

      if (error) throw error;
      setBoard(data as CRMBoard | null);
    } catch (err) {
      console.error('Error fetching board:', err);
    } finally {
      setIsLoadingBoard(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = String(active.id);
    
    if (activeId.startsWith('deal-')) {
      const dealId = activeId.replace('deal-', '');
      const deal = deals.find(d => d.id === dealId);
      if (deal) {
        setActiveDeal(deal);
        dragOriginPipelineRef.current = deal.pipeline_id;
        dragPreviewRef.current = null;
      }
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith('deal-')) return;

    const dealId = activeId.replace('deal-', '');
    const activeDealRef = deals.find(d => d.id === dealId);
    if (!activeDealRef) return;

    // Identifica coluna alvo + índice alvo a partir do alvo hovered.
    let targetPipelineId: string | null = null;
    let targetIndex = 0;

    if (overId.startsWith('pipeline-drop-')) {
      targetPipelineId = overId.replace('pipeline-drop-', '');
      const list = deals
        .filter(d => d.pipeline_id === targetPipelineId && d.id !== dealId)
        .sort((a, b) => a.position - b.position);
      targetIndex = list.length; // drop em área vazia/abaixo -> final
    } else if (overId.startsWith('deal-')) {
      const overDealId = overId.replace('deal-', '');
      const overDeal = deals.find(d => d.id === overDealId);
      if (!overDeal) return;
      targetPipelineId = overDeal.pipeline_id;
      const list = deals
        .filter(d => d.pipeline_id === targetPipelineId)
        .sort((a, b) => a.position - b.position);
      const overIdx = list.findIndex(d => d.id === overDealId);
      const sameCol = activeDealRef.pipeline_id === targetPipelineId;
      if (sameCol) {
        targetIndex = overIdx;
      } else {
        // Em coluna diferente: usar metade superior/inferior do card hovered
        // para decidir se inserimos antes ou depois.
        const overRect = (over.rect as { top: number; height: number } | undefined);
        const pointerY = (event.activatorEvent as PointerEvent | undefined)?.clientY ?? 0;
        const insertAfter = overRect ? pointerY > overRect.top + overRect.height / 2 : false;
        targetIndex = insertAfter ? overIdx + 1 : overIdx;
      }
    }

    if (!targetPipelineId) return;

    // Aplica o preview no estado real -> o SortableContext da coluna alvo
    // passa a conter o card e os vizinhos abrem espaço (placeholder visual).
    previewMove(dealId, targetPipelineId, targetIndex);
    // Registra o destino atual (fonte de verdade no commit).
    dragPreviewRef.current = {
      dealId,
      toPipelineId: targetPipelineId,
      toIndex: targetIndex,
    };
    // Mantém o overlay sincronizado com a coluna alvo.
    if (activeDealRef.pipeline_id !== targetPipelineId) {
      setActiveDeal(prev => prev ? { ...prev, pipeline_id: targetPipelineId! } : prev);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const wasActive = activeDeal;
    setActiveDeal(null);

    if (!over) {
      // Drop fora de qualquer alvo -> reverte preview consultando o banco.
      dragPreviewRef.current = null;
      dragOriginPipelineRef.current = null;
      if (wasActive) fetchDeals();
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    // Handle pipeline reordering
    if (activeId.startsWith('pipeline-') && overId.startsWith('pipeline-')) {
      const oldIndex = pipelines.findIndex(p => `pipeline-${p.id}` === activeId);
      const newIndex = pipelines.findIndex(p => `pipeline-${p.id}` === overId);
      
      if (oldIndex !== newIndex) {
        const reordered = arrayMove(pipelines, oldIndex, newIndex);
        await reorderPipelines(reordered);
      }
      return;
    }

    // Handle deal movement
    if (activeId.startsWith('deal-')) {
      const dealId = activeId.replace('deal-', '');
      const fromPipelineId =
        dragOriginPipelineRef.current ??
        deals.find(d => d.id === dealId)?.pipeline_id ??
        '';

      // Fonte primária: o destino calculado pelo próprio onDragOver.
      // Fallback: estado renderizado (pode estar atrasado).
      const preview = dragPreviewRef.current;
      let toPipelineId: string;
      let newPosition: number;

      if (preview && preview.dealId === dealId) {
        toPipelineId = preview.toPipelineId;
        newPosition = preview.toIndex;
      } else {
        const dealNow = deals.find(d => d.id === dealId);
        if (!dealNow) {
          dragPreviewRef.current = null;
          dragOriginPipelineRef.current = null;
          return;
        }
        toPipelineId = dealNow.pipeline_id;
        const destList = deals
          .filter(d => d.pipeline_id === toPipelineId)
          .sort((a, b) => a.position - b.position);
        newPosition = Math.max(0, destList.findIndex(d => d.id === dealId));
      }

      dragPreviewRef.current = null;
      dragOriginPipelineRef.current = null;

      await moveDeal({
        dealId,
        fromPipelineId: fromPipelineId || toPipelineId,
        toPipelineId,
        newPosition,
      });
    }
  };

  // Cancelamento: usuário soltou o Esc ou drop inválido — restaura do banco.
  const handleDragCancel = () => {
    setActiveDeal(null);
    dragOriginPipelineRef.current = null;
    dragPreviewRef.current = null;
    fetchDeals();
  };

  // Handlers
  const handleCreatePipeline = async (data: CRMPipelineFormData) => {
    return await createPipeline(data);
  };

  const handleEditPipeline = async (data: CRMPipelineFormData) => {
    if (!editingPipeline) return null;
    const success = await updatePipeline(editingPipeline.id, data);
    if (success) {
      setEditingPipeline(null);
      return editingPipeline;
    }
    return null;
  };

  const handleAddDeal = (pipeline: CRMPipeline) => {
    setSelectedPipelineForDeal(pipeline);
    setIsCreateDealOpen(true);
  };

  const handleCreateDeal = async (data: CRMDealFormData) => {
    if (!selectedPipelineForDeal) return null;
    return await createDeal(selectedPipelineForDeal.id, data);
  };

  const handleEditDeal = async (data: CRMDealFormData) => {
    if (!editingDeal) return null;
    const success = await updateDeal(editingDeal.id, data);
    if (success) {
      setEditingDeal(null);
      return editingDeal;
    }
    return null;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchBoard(), fetchDeals()]);
    setIsRefreshing(false);
  };

  // Loading state
  if (isLoadingBoard) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="flex gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-96 w-80 flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  // Board not found
  if (!board) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[50vh] gap-4">
        <p className="text-muted-foreground">Board não encontrado</p>
        <Button onClick={() => navigate('/crm-builder')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/crm-builder')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: board.color }}
          />
          
          <h1 className="text-xl font-bold text-foreground">{board.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatePipelineOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Etapa
            </Button>
          )}
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {user?.role === 'admin' && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsSettingsOpen(true)}
              className="gap-2"
            >
              <Settings2 className="h-4 w-4" />
              Configurações
            </Button>
          )}
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-muted/20">
          <BoardFilters
            filters={filters}
            onFiltersChange={setFilters}
            pipelines={pipelines.map(p => ({ id: p.id, name: p.name, color: p.color }))}
            assignees={assignees}
            totalDeals={deals.length}
            filteredDeals={filteredDeals.length}
            userName={user?.name}
          />
      </div>

      {/* Pipeline Container */}
      <div className="flex flex-col flex-1 min-h-0">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto p-4 pb-20 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={pipelines.map(p => `pipeline-${p.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex gap-4 h-full">
                {isLoadingPipelines ? (
                  [...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-96 min-w-[280px] max-w-[280px] flex-shrink-0" />
                  ))
                ) : (
                  <>
                    {pipelines.map((pipeline) => {
                      const pipelineDeals = getFilteredDealsByPipeline(pipeline.id);
                      return (
                        <PipelineColumn
                          key={pipeline.id}
                          pipeline={pipeline}
                          deals={pipelineDeals}
                          onEdit={() => canManage && setEditingPipeline(pipeline)}
                          onDelete={() => canManage && deletePipeline(pipeline.id)}
                          onAddDeal={() => handleAddDeal(pipeline)}
                        >
                          <SortableContext
                            items={pipelineDeals.map(d => `deal-${d.id}`)}
                            strategy={verticalListSortingStrategy}
                          >
                            {pipelineDeals.map((deal) => (
                              <DealCard
                                key={deal.id}
                                deal={deal}
                                pipelineColor={pipeline.color}
                                onClick={() => setViewingDeal(deal)}
                                onEdit={() => setEditingDeal(deal)}
                                onArchive={() => archiveDeal(deal.id)}
                                onWon={() => setDealStatus(deal.id, 'won')}
                                onLost={() => setDealStatus(deal.id, 'lost')}
                                onOpenChat={(d) => setChatPanelDeal(d)}
                                onChangePriority={(d, p) => updateDeal(d.id, { priority: p })}
                              />
                            ))}
                          </SortableContext>
                        </PipelineColumn>
                      );
                    })}
                    
                    {canManage && (
                      <Button
                        variant="outline"
                        className="h-auto min-h-[200px] min-w-[280px] max-w-[280px] flex-shrink-0 border-2 border-dashed hover:border-primary hover:bg-primary/5"
                        onClick={() => setIsCreatePipelineOpen(true)}
                      >
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Plus className="h-6 w-6" />
                          <span>Nova Etapa</span>
                        </div>
                      </Button>
                    )}
                  </>
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeDeal && (
                <DealCard
                  deal={activeDeal}
                  onEdit={() => {}}
                  onArchive={() => {}}
                  onWon={() => {}}
                  onLost={() => {}}
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Sheet lateral overlay com a conversa do card (aberto pelo ícone WhatsApp) */}
      <BoardChatSidePanel
        open={!!chatPanelDeal}
        onOpenChange={(o) => { if (!o) setChatPanelDeal(null); }}
        deal={chatPanelDeal}
      />

      {/* Fixed bottom scroll navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:left-[var(--sidebar-width,0px)]">
        <CRMScrollNavigation scrollRef={scrollRef} />
      </div>

      {/* Dialogs */}
      <CreatePipelineDialog
        open={isCreatePipelineOpen}
        onOpenChange={setIsCreatePipelineOpen}
        onSubmit={handleCreatePipeline}
      />

      <CreatePipelineDialog
        open={!!editingPipeline}
        onOpenChange={(open) => !open && setEditingPipeline(null)}
        onSubmit={handleEditPipeline}
        editPipeline={editingPipeline}
      />

      <CreateDealDialog
        open={isCreateDealOpen}
        onOpenChange={(open) => {
          setIsCreateDealOpen(open);
          if (!open) setSelectedPipelineForDeal(null);
        }}
        onSubmit={handleCreateDeal}
        pipelineName={selectedPipelineForDeal?.name}
        customFields={customFields}
      />

      <CreateDealDialog
        open={!!editingDeal}
        onOpenChange={(open) => !open && setEditingDeal(null)}
        onSubmit={handleEditDeal}
        editDeal={editingDeal}
        customFields={customFields}
      />

      <DealDetailsSheet
        deal={viewingDeal}
        pipeline={viewingDeal ? pipelines.find(p => p.id === viewingDeal.pipeline_id) : null}
        open={!!viewingDeal}
        onOpenChange={(open) => !open && setViewingDeal(null)}
        onEdit={() => {
          if (viewingDeal) {
            setEditingDeal(viewingDeal);
            setViewingDeal(null);
          }
        }}
        onArchive={() => viewingDeal && archiveDeal(viewingDeal.id)}
        onWon={() => viewingDeal && setDealStatus(viewingDeal.id, 'won')}
        onLost={() => viewingDeal && setDealStatus(viewingDeal.id, 'lost')}
        onUpdate={async (data) => {
          if (!viewingDeal) return false;
          return await updateDeal(viewingDeal.id, data);
        }}
        stages={pipelines}
        onMoveToStage={async (stageId) => {
          if (!viewingDeal) return false;
          return await moveDeal({
            dealId: viewingDeal.id,
            fromPipelineId: viewingDeal.pipeline_id,
            toPipelineId: stageId,
            newPosition: 0,
          });
        }}
        boards={allBoards}
        onMoveToBoard={async (targetBoardId) => {
          if (!viewingDeal) return null;
          const targetBoard = allBoards.find((b) => b.id === targetBoardId);
          const result = await moveDealToBoard(
            viewingDeal,
            targetBoardId,
            targetBoard?.name,
            board?.name,
            user?.name,
          );
          if (result) {
            toast.success(`Card movido para "${targetBoard?.name}"`, {
              action: {
                label: 'Abrir cópia',
                onClick: () => navigate(`/crm-builder/${result.newBoardId}`),
              },
            });
            await fetchDeals();
          }
          return result;
        }}
      />

      {/* Settings Sheet */}
      <BoardSettingsSheet
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        boardId={boardId || ''}
        codAgent={codAgent}
        clientId={clientId}
        boardName={board.name}
        pipelines={pipelines}
        deals={deals}
        canManage={canManage}
      />
    </div>
  );
}
