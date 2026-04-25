import { useState } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Archive,
  Calendar,
  Clock,
  DollarSign,
  Edit,
  Mail,
  Phone,
  Trophy,
  User,
  XCircle,
  History,
  FileText,
  Pencil,
  Check,
  X as XIcon,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useCRMDealHistory } from '../../hooks/useCRMDealHistory';
import { DealActivityTimeline } from './DealActivityTimeline';
import { DealLinksSection } from './DealLinksSection';
import { getChatLink, getJuliaLink } from '../../hooks/useCardLinks';
import type { CRMDeal, CRMDealFormData, CRMPipeline } from '../../types';
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
}: DealDetailsSheetProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [editingAssignee, setEditingAssignee] = useState(false);
  const [assigneeDraft, setAssigneeDraft] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [editingValue, setEditingValue] = useState(false);
  const [valueDraft, setValueDraft] = useState('');
  const [savingField, setSavingField] = useState<null | 'assignee' | 'description' | 'value'>(null);
  
  const { history, isLoading: isLoadingHistory, addNote } = useCRMDealHistory({
    dealId: open && deal ? deal.id : null,
  });

  if (!deal) return null;

  const priorityConfig = PRIORITY_CONFIG[deal.priority];
  const statusConfig = STATUS_CONFIG[deal.status];
  const isLinked = !!getChatLink(deal) || !!getJuliaLink(deal);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-semibold line-clamp-2">
                {deal.title}
              </SheetTitle>
              {pipeline && (
                <div className="flex items-center gap-2 mt-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: pipeline.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {pipeline.name}
                  </span>
                </div>
              )}
            </div>
            <Badge 
              variant="outline"
              className={cn('flex-shrink-0', statusConfig.color, statusConfig.bgColor)}
            >
              {statusConfig.label}
            </Badge>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="px-6 pt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details" className="gap-2">
                <FileText className="h-4 w-4" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <History className="h-4 w-4" />
                Atividade
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1">
            <TabsContent value="details" className="p-6 pt-4 m-0 space-y-6">
              {/* 1. Vínculos */}
              <DealLinksSection deal={deal} />

              {/* 2. Contato */}
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">Contato</h4>
                <div className="space-y-3">
                  {deal.contact_name && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm">{deal.contact_name}</span>
                    </div>
                  )}
                  {deal.contact_phone && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <a 
                        href={`tel:${deal.contact_phone}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {deal.contact_phone}
                      </a>
                    </div>
                  )}
                  {deal.contact_email && (
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <a 
                        href={`mailto:${deal.contact_email}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {deal.contact_email}
                      </a>
                    </div>
                  )}
                  {!deal.contact_name && !deal.contact_phone && !deal.contact_email && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma informação de contato
                    </p>
                  )}
                </div>
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
                    <Input
                      value={assigneeDraft}
                      onChange={(e) => setAssigneeDraft(e.target.value)}
                      placeholder="Nome do responsável"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveAssignee();
                        if (e.key === 'Escape') setEditingAssignee(false);
                      }}
                      className="h-9"
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

              {/* 4. Prioridade + Tempo na fase (linha própria, full-width via grid) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-lg border">
                  <div className="text-xs text-muted-foreground mb-1">Prioridade</div>
                  <Badge
                    variant="outline"
                    className={cn(priorityConfig.color, priorityConfig.bgColor)}
                  >
                    {priorityConfig.label}
                  </Badge>
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

              {/* 6. Descrição (editável) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Descrição</h4>
                  {!editingDescription && deal.description && onUpdate && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      onClick={startEditDescription}
                      title="Editar descrição"
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
                      placeholder="Descrição do card"
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
                    <Plus className="h-3.5 w-3.5" /> Adicionar descrição
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Sem descrição</p>
                )}
              </div>

              {/* 7. Valor (editável) */}
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

              {/* Previsão de fechamento (mantida acima das datas) */}
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
                  Criado em: {format(new Date(deal.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
                <div>
                  Atualizado em: {format(new Date(deal.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="activity" className="p-6 pt-4 m-0">
              <DealActivityTimeline
                history={history}
                isLoading={isLoadingHistory}
                onAddNote={addNote}
              />
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Actions Footer */}
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            {!isLinked && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  onOpenChange(false);
                  onEdit();
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            )}
            {deal.status === 'open' && (
              <>
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
              </>
            )}
          </div>
          <Button 
            variant="ghost" 
            className="w-full text-destructive hover:bg-destructive/10"
            onClick={() => {
              onArchive();
              onOpenChange(false);
            }}
          >
            <Archive className="h-4 w-4 mr-2" />
            {isLinked ? 'Excluir card' : 'Arquivar Deal'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
