import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import { TeamMemberSelect } from '@/components/TeamMemberSelect';
import { maskPhone } from '@/lib/inputMasks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Calendar,
  CalendarClock,
  CheckSquare,
  Clock,
  DollarSign,
  Mail,
  Phone,
  Trophy,
  User,
  XCircle,
  History,
  FileText,
  StickyNote,
  Pencil,
  Check,
  X as XIcon,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  Trash2,
  Flag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useCRMDealHistory } from '../../hooks/useCRMDealHistory';
import { DealActivityTimeline } from './DealActivityTimeline';
import { DealNotesPanel } from './DealNotesPanel';
import { DealTasksPanel } from './DealTasksPanel';
import { DealLinksSection } from './DealLinksSection';
import { DealJuliaPanel } from './DealJuliaPanel';
import { getChatLink, getJuliaLink } from '../../hooks/useCardLinks';
import type { CRMBoard, CRMDeal, CRMDealFormData, CRMPipeline } from '../../types';
import { PRIORITY_CONFIG, STATUS_CONFIG } from '../../types';

interface DealDetailsSheetProps {
  deal: CRMDeal | null;
  pipeline?: CRMPipeline | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onArchive: () => void;
  onWon: () => void;
  onLost: () => void;
  onUpdate?: (data: Partial<CRMDealFormData>) => Promise<boolean> | void;
  /** Esconde o bloco de ações Ganho/Perdido (e o botão Editar contextual) */
  hideStatusActions?: boolean;
  /** Esconde o botão Arquivar/Excluir do rodapé */
  hideArchiveAction?: boolean;
  /** Conteúdo extra renderizado no rodapé (ex.: "Abrir no CRM") */
  footerExtra?: React.ReactNode;
  /** Lista completa de etapas (pipelines) do board para permitir mover */
  stages?: CRMPipeline[];
  /** Callback chamado quando o usuário escolhe mover o deal para outra etapa */
  onMoveToStage?: (stageId: string) => Promise<boolean | void> | boolean | void;
  /** Lista de quadros disponíveis para mover o card (exclui o atual). */
  boards?: CRMBoard[];
  /** Callback ao mover o card para outro quadro. Deve criar cópia no destino e arquivar o original.
   *  Recebe opcionalmente o `targetPipelineId` selecionado pelo usuário no quadro destino. */
  onMoveToBoard?: (
    targetBoardId: string,
    targetPipelineId?: string,
  ) => Promise<{ newDealId: string; newBoardId: string } | null | void>;
}

export function DealDetailsSheet({
  deal,
  pipeline,
  open,
  onOpenChange,
  onEdit,
  onArchive,
  onWon,
  onLost,
  onUpdate,
  hideStatusActions = false,
  hideArchiveAction = false,
  footerExtra,
  stages,
  onMoveToStage,
  boards,
  onMoveToBoard,
}: DealDetailsSheetProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [editingContact, setEditingContact] = useState(false);
  const [contactDraft, setContactDraft] = useState<{ name: string; phone: string; email: string }>({
    name: '',
    phone: '',
    email: '',
  });
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingValue, setEditingValue] = useState(false);
  const [valueDraft, setValueDraft] = useState('');
  const [savingField, setSavingField] = useState<null | 'assignee' | 'description' | 'value' | 'contact' | 'due_date'>(null);
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState('');
  const [stagesExpanded, setStagesExpanded] = useState(false);
  const [movingToStage, setMovingToStage] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [savingPriority, setSavingPriority] = useState<CRMDealFormData['priority'] | null>(null);
  const [boardsExpanded, setBoardsExpanded] = useState(false);
  const [pendingTargetBoardId, setPendingTargetBoardId] = useState<string | null>(null);
  const [selectedTargetBoardId, setSelectedTargetBoardId] = useState<string | null>(null);
  const [pendingTargetStageId, setPendingTargetStageId] = useState<string | null>(null);
  const [targetBoardStages, setTargetBoardStages] = useState<Array<{ id: string; name: string; color: string | null; position: number }>>([]);
  const [loadingTargetStages, setLoadingTargetStages] = useState(false);
  const [movingToBoard, setMovingToBoard] = useState(false);
  const [boardActiveStageCount, setBoardActiveStageCount] = useState<Record<string, number>>({});
  const [loadingBoardStages, setLoadingBoardStages] = useState(false);
  
  // Mesma fonte usada na página Equipe (vw_equipe filtrada por client_id),
  // que inclui o dono/responsável principal e todos os membros do mesmo cliente.
  const { data: team = [] } = useTeamByClient();

  const { history, isLoading: isLoadingHistory, addNote } = useCRMDealHistory({
    dealId: open && deal ? deal.id : null,
    userName: user?.name,
  });

  const priorityConfig = deal ? PRIORITY_CONFIG[deal.priority] : null;
  const statusConfig = deal ? STATUS_CONFIG[deal.status] : null;
  const isLinked = deal ? (!!getChatLink(deal) || !!getJuliaLink(deal)) : false;

  const showStagesBlock = !!deal && !!stages && stages.length > 0 && !!onMoveToStage;
  const sortedStages = showStagesBlock
    ? [...stages!].sort((a, b) => a.position - b.position)
    : [];
  const currentStage = deal
    ? (sortedStages.find((s) => s.id === deal.pipeline_id) || pipeline || null)
    : null;

  const otherBoards = deal
    ? (boards || []).filter((b) => b.id !== deal.board_id && !b.is_archived)
    : [];
  // Mostra o bloco sempre que o callback existir, mesmo sem outros boards —
  // assim o usuário entende por que a ação não está disponível em vez de
  // achar que a feature sumiu.
  const showBoardsBlock = !!deal && !!onMoveToBoard;
  const hasOtherBoards = otherBoards.length > 0;
  const currentBoard = deal ? ((boards || []).find((b) => b.id === deal.board_id) || null) : null;
  const targetBoard = pendingTargetBoardId
    ? otherBoards.find((b) => b.id === pendingTargetBoardId) || null
    : null;
  const selectedTargetBoard = selectedTargetBoardId
    ? otherBoards.find((b) => b.id === selectedTargetBoardId) || null
    : null;
  const targetStage = pendingTargetStageId
    ? targetBoardStages.find((s) => s.id === pendingTargetStageId) || null
    : null;

  // Pré-carrega contagem de etapas ativas por board para sinalizar/desabilitar
  // boards inválidos antes de tentar mover.
  const otherBoardIds = useMemo(() => otherBoards.map((b) => b.id).sort().join(','), [otherBoards]);
  useEffect(() => {
    if (!boardsExpanded || !showBoardsBlock) return;
    const ids = otherBoards.map((b) => b.id);
    if (ids.length === 0) return;
    let cancelled = false;
    setLoadingBoardStages(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('crm_pipelines')
          .select('board_id')
          .in('board_id', ids)
          .eq('is_active', true);
        if (error) throw error;
        const counts: Record<string, number> = {};
        for (const row of (data || []) as Array<{ board_id: string }>) {
          counts[row.board_id] = (counts[row.board_id] || 0) + 1;
        }
        if (!cancelled) setBoardActiveStageCount(counts);
      } catch (err) {
        if (!cancelled) {
          console.warn('[DealDetailsSheet] erro ao carregar etapas dos quadros', err);
        }
      } finally {
        if (!cancelled) setLoadingBoardStages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [boardsExpanded, showBoardsBlock, otherBoardIds]);

  // Carrega etapas ativas do board selecionado para o usuário escolher destino
  useEffect(() => {
    if (!selectedTargetBoardId) {
      setTargetBoardStages([]);
      return;
    }
    let cancelled = false;
    setLoadingTargetStages(true);
    (async () => {
      try {
        const { data, error } = await supabase
          .from('crm_pipelines')
          .select('id, name, color, position')
          .eq('board_id', selectedTargetBoardId)
          .eq('is_active', true)
          .order('position', { ascending: true });
        if (error) throw error;
        if (!cancelled) {
          setTargetBoardStages((data || []) as Array<{ id: string; name: string; color: string | null; position: number }>);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[DealDetailsSheet] erro ao carregar etapas do quadro destino', err);
          setTargetBoardStages([]);
          toast.error('Não foi possível carregar as etapas do CRM selecionado.');
        }
      } finally {
        if (!cancelled) setLoadingTargetStages(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedTargetBoardId]);

  // Early return APÓS todos os hooks para respeitar a Regra dos Hooks do React.
  if (!deal) return null;


  const handleStageClick = async (stageId: string) => {
    if (!onMoveToStage || stageId === deal.pipeline_id || movingToStage) return;
    setMovingToStage(stageId);
    try {
      await onMoveToStage(stageId);
      setStagesExpanded(false);
    } finally {
      setMovingToStage(null);
    }
  };

  const confirmMoveToBoard = async () => {
    if (!pendingTargetBoardId || !pendingTargetStageId || !onMoveToBoard) return;
    setMovingToBoard(true);
    try {
      const result = await onMoveToBoard(pendingTargetBoardId, pendingTargetStageId);
      if (result) {
        setPendingTargetBoardId(null);
        setPendingTargetStageId(null);
        setSelectedTargetBoardId(null);
        setTargetBoardStages([]);
        setBoardsExpanded(false);
        onOpenChange(false);
      } else {
        // erro notificado pelo helper; fecha apenas o dialog mantendo escolhas
        setPendingTargetBoardId(null);
        setPendingTargetStageId(null);
      }
    } finally {
      setMovingToBoard(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: deal.currency || 'BRL',
    }).format(value);
  };

  const timeInStage = formatDistanceToNow(new Date(deal.stage_entered_at), {
    addSuffix: false,
    locale: ptBR,
  });

  const startEditAssignee = () => {
    setAssigneeDraft(deal.assigned_to || '');
    setEditingAssignee(true);
  };
  const saveAssignee = async () => {
    if (!onUpdate) { setEditingAssignee(false); return; }
    const next = assigneeDraft.trim() || undefined;
    if (next === (deal.assigned_to || undefined)) { setEditingAssignee(false); return; }
    setSavingField('assignee');
    await onUpdate({ assigned_to: next });
    setSavingField(null);
    setEditingAssignee(false);
  };

  const startEditContact = () => {
    setContactDraft({
      name: deal.contact_name || '',
      phone: deal.contact_phone || '',
      email: deal.contact_email || '',
    });
    setEditingContact(true);
  };
  const saveContact = async () => {
    if (!onUpdate) { setEditingContact(false); return; }
    const next = {
      contact_name: contactDraft.name.trim() || undefined,
      contact_phone: isLinked ? (deal.contact_phone || undefined) : (contactDraft.phone.trim() || undefined),
      contact_email: contactDraft.email.trim() || undefined,
    };
    const unchanged =
      next.contact_name === (deal.contact_name || undefined) &&
      next.contact_phone === (deal.contact_phone || undefined) &&
      next.contact_email === (deal.contact_email || undefined);
    if (unchanged) { setEditingContact(false); return; }
    setSavingField('contact');
    await onUpdate(next);
    setSavingField(null);
    setEditingContact(false);
  };

  const startEditDescription = () => {
    setDescriptionDraft(deal.description || '');
    setEditingDescription(true);
  };
  const saveDescription = async () => {
    if (!onUpdate) { setEditingDescription(false); return; }
    const next = descriptionDraft.trim() || undefined;
    if (next === (deal.description || undefined)) { setEditingDescription(false); return; }
    setSavingField('description');
    await onUpdate({ description: next });
    setSavingField(null);
    setEditingDescription(false);
  };

  const startEditValue = () => {
    setValueDraft(deal.value ? String(deal.value) : '');
    setEditingValue(true);
  };
  const saveValue = async () => {
    if (!onUpdate) { setEditingValue(false); return; }
    const parsed = Number(valueDraft.replace(',', '.'));
    const next = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    if (next === deal.value) { setEditingValue(false); return; }
    setSavingField('value');
    await onUpdate({ value: next });
    setSavingField(null);
    setEditingValue(false);
  };

  const startEditDueDate = () => {
    setDueDateDraft(deal.due_date || '');
    setEditingDueDate(true);
  };
  const saveDueDate = async () => {
    if (!onUpdate) { setEditingDueDate(false); return; }
    const next = dueDateDraft || undefined;
    if (next === (deal.due_date || undefined)) { setEditingDueDate(false); return; }
    setSavingField('due_date');
    await onUpdate({ due_date: next });
    setSavingField(null);
    setEditingDueDate(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="text-xl font-semibold line-clamp-2 text-left">
            {deal.title}
          </SheetTitle>
          <div className="mt-2">
            <Badge
              variant="outline"
              className={cn(statusConfig.color, statusConfig.bgColor)}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </SheetHeader>

        {/* Bloco Quadro — independente do bloco Etapas. Aparece sempre que o
            callback onMoveToBoard estiver disponível. */}
        {showBoardsBlock && (
            <div className="px-6 py-3 border-b bg-muted/20">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                   <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    CRM
                  </span>
                  {currentBoard && (
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: currentBoard.color || '#6b7280' }}
                      />
                      <span className="text-sm font-medium truncate">{currentBoard.name}</span>
                    </div>
                  )}
                </div>
                {hasOtherBoards && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => setBoardsExpanded((v) => !v)}
                  title={boardsExpanded ? 'Fechar' : 'Mover para outro CRM'}
                  aria-label={boardsExpanded ? 'Fechar' : 'Mover para outro CRM'}
                >
                  {boardsExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5" />
                  )}
                </Button>
                )}
              </div>

              {!hasOtherBoards && (
                <p className="text-xs text-muted-foreground mt-2">
                  Nenhum outro CRM disponível para mover este card.
                </p>
              )}

              {hasOtherBoards && boardsExpanded && (
                <div className="space-y-1.5 mt-3">
                  <p className="text-xs text-muted-foreground px-1 mb-1">
                    Escolha o CRM e em seguida a etapa para mover o card.
                  </p>
                  {otherBoards.map((b) => {
                    const stageCount = boardActiveStageCount[b.id];
                    const noStages = stageCount === 0;
                    const isSelected = selectedTargetBoardId === b.id;
                    const isDisabled = movingToBoard || noStages;
                    return (
                      <div key={b.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (noStages) {
                              toast.error(`O CRM "${b.name}" não possui etapas ativas. Crie ao menos uma etapa antes de mover o card.`);
                              return;
                            }
                            setSelectedTargetBoardId(isSelected ? null : b.id);
                          }}
                          disabled={isDisabled}
                          title={noStages ? 'Sem etapas ativas — não é possível mover para este CRM' : undefined}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-colors',
                            noStages
                              ? 'cursor-not-allowed opacity-60 border-dashed'
                              : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20',
                            isSelected && !noStages && 'bg-muted/40 border-foreground/20',
                            movingToBoard && !noStages && 'opacity-60'
                          )}
                        >
                          <span
                            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: b.color || '#6b7280' }}
                          />
                          <span className="text-sm flex-1 truncate">{b.name}</span>
                          {loadingBoardStages && stageCount === undefined ? (
                            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />
                          ) : noStages ? (
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex-shrink-0">
                              sem etapas
                            </span>
                          ) : isSelected ? (
                            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>

                        {isSelected && (
                          <div className="ml-5 pl-3 border-l border-border/60 space-y-1">
                            <p className="text-[11px] text-muted-foreground px-1 pt-1">
                              Clique na etapa de destino para confirmar a mudança:
                            </p>
                            {loadingTargetStages ? (
                              <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Carregando etapas...
                              </div>
                            ) : targetBoardStages.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                Nenhuma etapa ativa neste CRM.
                              </p>
                            ) : (
                              targetBoardStages.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  disabled={movingToBoard}
                                  onClick={() => {
                                    setPendingTargetBoardId(b.id);
                                    setPendingTargetStageId(s.id);
                                  }}
                                  className={cn(
                                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-md border text-left transition-colors',
                                    'cursor-pointer hover:bg-muted/50 hover:border-foreground/20',
                                    movingToBoard && 'opacity-60 cursor-not-allowed'
                                  )}
                                >
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: s.color || '#6b7280' }}
                                  />
                                  <span className="text-sm flex-1 truncate">{s.name}</span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
        )}

        {/* Bloco Etapas (acima das abas) — só renderiza quando há stages + onMoveToStage */}
        {showStagesBlock && (
        <>
          <div className="px-6 py-3 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Etapa
                </span>
                {currentStage && (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: currentStage.color || '#6b7280' }}
                    />
                    <span className="text-sm font-medium truncate">{currentStage.name}</span>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() => setStagesExpanded((v) => !v)}
                title={stagesExpanded ? 'Fechar' : 'Editar etapa'}
                aria-label={stagesExpanded ? 'Fechar' : 'Editar etapa'}
              >
                {stagesExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <Pencil className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>

            {stagesExpanded && (
              <div className="space-y-1.5 mt-3">
                {sortedStages.map((stage) => {
                  const isCurrent = stage.id === deal.pipeline_id;
                  const isMoving = movingToStage === stage.id;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => handleStageClick(stage.id)}
                      disabled={isCurrent || !!movingToStage}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-colors',
                        isCurrent
                          ? 'border-primary/40 bg-primary/5 cursor-default'
                          : 'cursor-pointer hover:bg-muted/50 hover:border-foreground/20',
                        movingToStage && !isMoving && 'opacity-60'
                      )}
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: stage.color || '#6b7280' }}
                      />
                      <span className="text-sm flex-1 truncate">{stage.name}</span>
                      {isMoving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                      ) : isCurrent ? (
                        <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
        )}

        {/* Tabs + conteúdo */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details" className="gap-1 text-xs px-1">
                <FileText className="h-3.5 w-3.5" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1 text-xs px-1">
                <CheckSquare className="h-3.5 w-3.5" />
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="notes" className="gap-1 text-xs px-1">
                <StickyNote className="h-3.5 w-3.5" />
                Anotações
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1 text-xs px-1">
                <History className="h-3.5 w-3.5" />
                Histórico
              </TabsTrigger>
            </TabsList>
          </div>

          <div>
            <TabsContent value="details" className="p-6 pt-4 m-0 space-y-6">
              {/* 1. Contato */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Contato</h4>
                  {!editingContact && onUpdate && (deal.contact_name || deal.contact_phone || deal.contact_email) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={startEditContact}
                      title="Editar contato"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>

                {editingContact ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        value={contactDraft.name}
                        placeholder="Nome do contato"
                        onChange={(e) => setContactDraft((d) => ({ ...d, name: e.target.value }))}
                        className="h-9"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        value={contactDraft.phone}
                        placeholder="(00) 00000-0000"
                        onChange={(e) => setContactDraft((d) => ({ ...d, phone: maskPhone(e.target.value) }))}
                        className="h-9"
                        readOnly={isLinked}
                        disabled={isLinked}
                        title={isLinked ? 'Telefone vinculado à conversa — não editável' : undefined}
                        inputMode="tel"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <Input
                        value={contactDraft.email}
                        placeholder="email@exemplo.com"
                        onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))}
                        className="h-9"
                        type="email"
                        inputMode="email"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingContact(false)}>
                        <XIcon className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={saveContact} disabled={savingField === 'contact'}>
                        <Check className="h-4 w-4 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 min-h-8">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {deal.contact_name ? (
                        <span className="text-sm leading-tight break-words">{deal.contact_name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sem nome</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 min-h-8">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {deal.contact_phone ? (
                        <a
                          href={`tel:${deal.contact_phone}`}
                          className="text-sm text-primary hover:underline leading-tight break-all"
                        >
                          {deal.contact_phone}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sem telefone</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 min-h-8">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      {deal.contact_email ? (
                        <a
                          href={`mailto:${deal.contact_email}`}
                          className="text-sm text-primary hover:underline leading-tight break-all"
                        >
                          {deal.contact_email}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Sem e-mail</span>
                      )}
                    </div>
                    {!deal.contact_name && !deal.contact_phone && !deal.contact_email && onUpdate && (
                      <Button variant="outline" size="sm" onClick={startEditContact} className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" /> Adicionar contato
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Vínculo com a Jul.IA — logo após o Contato */}
              <DealJuliaPanel deal={deal} />

              {/* 2. Observações (antiga Descrição/Destaque) */}
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Observações</h4>
                  {!editingDescription && deal.description && onUpdate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={startEditDescription}
                      title="Editar observações"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {editingDescription ? (
                  <div className="space-y-2">
                    <Textarea
                      value={descriptionDraft}
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder="Observações do card"
                      autoFocus
                      className="min-h-[100px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingDescription(false);
                      }}
                    />
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingDescription(false)}>
                        <XIcon className="h-4 w-4 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={saveDescription} disabled={savingField === 'description'}>
                        <Check className="h-4 w-4 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : deal.description ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {deal.description}
                  </p>
                ) : onUpdate ? (
                  <Button variant="outline" size="sm" onClick={startEditDescription} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Adicionar observações
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem observações</p>
                )}
              </div>

              {/* 3. Responsável (full-width, editável) */}
              <Separator />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Responsável</h4>
                  {!editingAssignee && onUpdate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={startEditAssignee}
                      title="Editar responsável"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {editingAssignee ? (
                  <div className="flex items-center gap-2">
                    <TeamMemberSelect
                      members={team}
                      valueKey="name"
                      value={assigneeDraft || null}
                      onValueChange={(v) => setAssigneeDraft(v ?? '')}
                      allowUnassigned
                      unassignedLabel="Não atribuído"
                      showCurrentUserShortcut
                      className="flex-1"
                    />
                    <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={saveAssignee} disabled={savingField === 'assignee'}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={() => setEditingAssignee(false)}>
                      <XIcon className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 rounded-md border',
                      deal.assigned_to
                        ? 'bg-primary/5 border-primary/30 text-primary'
                        : 'bg-muted text-muted-foreground border-border'
                    )}
                  >
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{deal.assigned_to || 'Não atribuído'}</span>
                  </div>
                )}
              </div>

              {/* 3a. Data de Entrega (logo abaixo do Responsável) */}
              {onUpdate && (
                <>
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-5 w-5 text-muted-foreground" />
                      <h4 className="text-sm font-medium">Data de Entrega</h4>
                    </div>
                    {!editingDueDate && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        onClick={startEditDueDate}
                        title="Editar data de entrega"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {editingDueDate ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={dueDateDraft}
                        onChange={(e) => setDueDateDraft(e.target.value)}
                        autoFocus
                        className="h-9 flex-1"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveDueDate();
                          if (e.key === 'Escape') setEditingDueDate(false);
                        }}
                      />
                      <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={saveDueDate} disabled={savingField === 'due_date'}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={() => setEditingDueDate(false)}>
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : deal.due_date ? (() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const isOverdue = deal.due_date < today;
                    const isToday = deal.due_date === today;
                    return (
                      <div className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium',
                        isOverdue
                          ? 'bg-red-500/10 text-red-700 border-red-500/30'
                          : isToday
                          ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30'
                          : 'bg-green-500/10 text-green-700 border-green-500/30'
                      )}>
                        <CalendarClock className="h-4 w-4 flex-shrink-0" />
                        {format(new Date(deal.due_date + 'T00:00:00'), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        <span className="ml-auto text-xs font-normal">
                          {isOverdue ? 'Em atraso' : isToday ? 'Vence hoje' : 'No prazo'}
                        </span>
                      </div>
                    );
                  })() : (
                    <Button variant="outline" size="sm" onClick={startEditDueDate} className="gap-1.5">
                      <Plus className="h-3.5 w-3.5" /> Definir data de entrega
                    </Button>
                  )}
                </div>
                </>
              )}

              {/* 4. Prioridade + Tempo na fase (linha própria, full-width via grid) */}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">Prioridade</span>
                    {savingPriority && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {onUpdate ? (
                    <TooltipProvider delayDuration={150}>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(Object.entries(PRIORITY_CONFIG) as Array<[CRMDealFormData['priority'], typeof PRIORITY_CONFIG[keyof typeof PRIORITY_CONFIG]]>).map(([key, cfg]) => {
                          const isActive = deal.priority === key;
                          return (
                            <Tooltip key={key}>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  disabled={!!savingPriority || isActive}
                                  onClick={async () => {
                                    setSavingPriority(key);
                                    try {
                                      await onUpdate({ priority: key });
                                    } finally {
                                      setSavingPriority(null);
                                    }
                                  }}
                                  aria-label={`Prioridade ${cfg.label}`}
                                  className={cn(
                                    'h-9 w-full inline-flex items-center justify-center rounded-md border-2 transition-all',
                                    cfg.color,
                                    isActive
                                      ? cn(cfg.bgColor, 'border-current ring-2 ring-current/40 shadow-sm cursor-default')
                                      : 'border-border hover:bg-muted hover:border-current/50',
                                    savingPriority && !isActive && 'opacity-50'
                                  )}
                                >
                                  <Flag className="h-4 w-4 fill-current" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom">
                                {isActive ? `Atual: ${cfg.label}` : `Definir como ${cfg.label}`}
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </TooltipProvider>
                  ) : (
                    <Badge
                      variant="outline"
                      className={cn(priorityConfig.color, priorityConfig.bgColor)}
                    >
                      {priorityConfig.label}
                    </Badge>
                  )}
                </div>
                <div className="p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1">Tempo na Etapa</div>
                  <div className="flex items-center gap-1 font-medium text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {timeInStage}
                  </div>
                </div>
              </div>

              {/* 5. Tags */}
              {deal.tags && deal.tags.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Tags</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {deal.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Vínculos: Chat (antes do valor) */}
              <DealLinksSection deal={deal} />

              {/* Valor (editável) */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Valor</span>
                  </div>
                  {!editingValue ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(deal.value)}
                      </span>
                      {onUpdate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={startEditValue}
                          title="Editar valor"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={valueDraft}
                        onChange={(e) => setValueDraft(e.target.value)}
                        autoFocus
                        className="h-9 w-32 text-right"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveValue();
                          if (e.key === 'Escape') setEditingValue(false);
                        }}
                      />
                      <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={saveValue} disabled={savingField === 'value'}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 flex-shrink-0" onClick={() => setEditingValue(false)}>
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Previsão de fechamento */}
              {deal.expected_close_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="text-xs text-muted-foreground">Previsão de Fechamento</div>
                    <div className="text-sm font-medium">
                      {format(new Date(deal.expected_close_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              )}

              {/* 8. Datas (rodapé) */}
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  Criado{deal.created_by ? ` por ${deal.created_by}` : ''} em: {format(new Date(deal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <div>
                  Atualizado{(deal.updated_by || deal.created_by) ? ` por ${deal.updated_by || deal.created_by}` : ''} em: {format(new Date(deal.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="tasks" className="p-6 pt-4 m-0">
              <DealTasksPanel dealId={deal.id} />
            </TabsContent>

            <TabsContent value="notes" className="p-6 pt-4 m-0">
              <DealNotesPanel
                notes={history.filter((h) => h.action === 'note_added')}
                isLoading={isLoadingHistory}
                onAddNote={addNote}
              />
            </TabsContent>

            <TabsContent value="history" className="p-6 pt-4 m-0">
              <DealActivityTimeline
                history={history}
                isLoading={isLoadingHistory}
              />
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t bg-background space-y-2 mt-auto">
          {footerExtra ? (
            // Modo Chat: usa exatamente o que o consumidor passar
            footerExtra
          ) : (
            <>
              {/* Linha única: Perdido | Ganho | [Arquivar (ícone)] */}
              <div className="flex items-center gap-2">
                {!hideStatusActions && deal.status === 'open' && (
                  <>
                    <Button
                      variant="outline"
                      className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => {
                        onLost();
                        onOpenChange(false);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Perdido
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                      onClick={() => {
                        onWon();
                        onOpenChange(false);
                      }}
                    >
                      <Trophy className="h-4 w-4 mr-2" />
                      Ganho
                    </Button>
                  </>
                )}
                {!hideArchiveAction && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    title="Arquivar card"
                    aria-label="Arquivar card"
                    onClick={() => setConfirmArchive(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Arquivar este card?</AlertDialogTitle>
              <AlertDialogDescription>
                {isLinked
                  ? `O card "${deal.title}" será arquivado e o vínculo com a conversa será mantido. Você poderá restaurá-lo depois em arquivados.`
                  : `O card "${deal.title}" será arquivado e removido do board. Você poderá restaurá-lo depois em arquivados.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  setConfirmArchive(false);
                  onArchive();
                  onOpenChange(false);
                }}
              >
                Arquivar Card
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirmação: mover para outro quadro */}
        <AlertDialog
          open={!!pendingTargetBoardId}
          onOpenChange={(o) => { if (!o && !movingToBoard) setPendingTargetBoardId(null); }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Tem certeza que deseja mover o card do CRM "{currentBoard?.name ?? 'atual'}" para o CRM "{targetBoard?.name}"?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O card será movido e sumirá do CRM atual.
                {isLinked
                  ? ' O vínculo com a conversa será transferido para a cópia.'
                  : ''}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={movingToBoard}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={movingToBoard}
                onClick={(e) => { e.preventDefault(); confirmMoveToBoard(); }}
              >
                {movingToBoard ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Movendo...
                  </>
                ) : (
                  'Mover card'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
