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
import { BoardFilters, type BoardFiltersState } from './components/filters/BoardFilters';
import { BoardSettingsSheet } from './components/settings/BoardSettingsSheet';
import { useCRMPipelines } from './hooks/useCRMPipelines';
import { useCRMDeals } from './hooks/useCRMDeals';
import { useCRMCustomFields } from './hooks/useCRMCustomFields';
import type { CRMBoard, CRMPipeline, CRMDeal, CRMPipelineFormData, CRMDealFormData } from './types';
import { CRMScrollNavigation } from '@/pages/crm/components/CRMScrollNavigation';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const codAgent = user?.cod_agent?.toString() || '';

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
  } = useCRMPipelines({ boardId: boardId || null, codAgent });

  // Deals
  const {
    deals,
    isLoading: isLoadingDeals,
    getDealsByPipeline,
    createDeal,
    updateDeal,
    moveDeal,
    setDealStatus,
    archiveDeal,
    fetchDeals,
  } = useCRMDeals({ boardId: boardId || null, codAgent });

  // Custom Fields
  const { fields: customFields } = useCRMCustomFields({ boardId: boardId || null, codAgent });

  // Filters state
  const [filters, setFilters] = useState<BoardFiltersState>({
    search: '',
    priorities: [],
    statuses: [],
    pipelineIds: [],
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Dialog states
  const [isCreatePipelineOpen, setIsCreatePipelineOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<CRMPipeline | null>(null);
  const [isCreateDealOpen, setIsCreateDealOpen] = useState(false);
  const [selectedPipelineForDeal, setSelectedPipelineForDeal] = useState<CRMPipeline | null>(null);
  const [editingDeal, setEditingDeal] = useState<CRMDeal | null>(null);
  const [viewingDeal, setViewingDeal] = useState<CRMDeal | null>(null);

  // DnD state
  const [activeDeal, setActiveDeal] = useState<CRMDeal | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Scroll ref for custom navigation
  const scrollRef = useRef<HTMLDivElement>(null);

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

      return true;
    });
  }, [deals, filters]);

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
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

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
      if (deal) setActiveDeal(deal);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Handle drag over logic for pipelines
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) return;

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
      const deal = deals.find(d => d.id === dealId);
      if (!deal) return;

      // Determine target pipeline
      let targetPipelineId: string | null = null;
      let newPosition = 0;

      if (overId.startsWith('pipeline-')) {
        targetPipelineId = overId.replace('pipeline-', '');
        const pipelineDeals = getDealsByPipeline(targetPipelineId);
        newPosition = pipelineDeals.length;
      } else if (overId.startsWith('deal-')) {
        const overDealId = overId.replace('deal-', '');
        const overDeal = deals.find(d => d.id === overDealId);
        if (overDeal) {
          targetPipelineId = overDeal.pipeline_id;
          const pipelineDeals = getDealsByPipeline(targetPipelineId);
          const overIndex = pipelineDeals.findIndex(d => d.id === overDealId);
          newPosition = overIndex;
        }
      }

      if (targetPipelineId && (targetPipelineId !== deal.pipeline_id || activeDeal)) {
        await moveDeal({
          dealId: deal.id,
          fromPipelineId: deal.pipeline_id,
          toPipelineId: targetPipelineId,
          newPosition,
        });
      }
    }
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreatePipelineOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Etapa
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Configurações
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="px-4 py-3 border-b bg-muted/20">
        <BoardFilters
          filters={filters}
          onFiltersChange={setFilters}
          pipelines={pipelines.map(p => ({ id: p.id, name: p.name, color: p.color }))}
          totalDeals={deals.length}
          filteredDeals={filteredDeals.length}
        />
      </div>

      {/* Pipeline Container */}
      <div className="flex flex-col flex-1 min-h-0 relative">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto p-4 pb-16 scrollbar-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
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
                          onEdit={() => setEditingPipeline(pipeline)}
                          onDelete={() => deletePipeline(pipeline.id)}
                          onAddDeal={() => handleAddDeal(pipeline)}
                        >
                          <SortableContext
                            items={pipelineDeals.map(d => `deal-${d.id}`)}
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
                              />
                            ))}
                          </SortableContext>
                        </PipelineColumn>
                      );
                    })}
                    
                    {/* Add pipeline button */}
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
        <div className="absolute bottom-0 left-0 right-0">
          <CRMScrollNavigation scrollRef={scrollRef} />
        </div>
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
      />

      {/* Settings Sheet */}
      <BoardSettingsSheet
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        boardId={boardId || ''}
        codAgent={codAgent}
        boardName={board.name}
        pipelines={pipelines}
        deals={deals}
      />
    </div>
  );
}
