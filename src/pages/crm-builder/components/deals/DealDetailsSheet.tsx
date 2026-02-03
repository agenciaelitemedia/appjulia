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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useCRMDealHistory } from '../../hooks/useCRMDealHistory';
import { DealActivityTimeline } from './DealActivityTimeline';
import type { CRMDeal, CRMPipeline } from '../../types';
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
}: DealDetailsSheetProps) {
  const [activeTab, setActiveTab] = useState('details');
  
  const { history, isLoading: isLoadingHistory, addNote } = useCRMDealHistory({
    dealId: open && deal ? deal.id : null,
  });

  if (!deal) return null;

  const priorityConfig = PRIORITY_CONFIG[deal.priority];
  const statusConfig = STATUS_CONFIG[deal.status];

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
              {/* Value */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Valor</span>
                </div>
                <span className="text-xl font-bold text-primary">
                  {formatCurrency(deal.value)}
                </span>
              </div>

              {/* Priority & Time in Stage */}
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
                  <div className="flex items-center gap-1 font-medium">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    {timeInStage}
                  </div>
                </div>
              </div>

              {/* Description */}
              {deal.description && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Descrição</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {deal.description}
                  </p>
                </div>
              )}

              <Separator />

              {/* Contact Info */}
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

              {/* Expected Close Date */}
              {deal.expected_close_date && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="text-xs text-muted-foreground">Previsão de Fechamento</div>
                      <div className="text-sm font-medium">
                        {format(new Date(deal.expected_close_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Tags */}
              {deal.tags && deal.tags.length > 0 && (
                <>
                  <Separator />
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
                </>
              )}

              {/* Timestamps */}
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
            Arquivar Deal
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
