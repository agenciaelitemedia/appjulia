import { X, Calendar, Building2, Scale, FileText, Users, DollarSign, Copy, ExternalLink } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ProcessData } from '../types';
import { formatDate, formatCurrency, getTribunalColor } from '../utils';
import { MovementTimeline } from './MovementTimeline';

interface ProcessDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  process: ProcessData | null;
  tribunal: string | null;
}

export function ProcessDetailsSheet({
  open,
  onOpenChange,
  process,
  tribunal,
}: ProcessDetailsSheetProps) {
  if (!process || !tribunal) return null;

  const copyProcessNumber = () => {
    navigator.clipboard.writeText(process.numeroProcesso);
    toast.success('Número copiado!');
  };

  const getTribunalCategory = (key: string): string => {
    if (['STF', 'STJ', 'TST', 'TSE', 'STM'].includes(key)) return 'Superior';
    if (key.startsWith('TRF')) return 'Federal';
    if (key.startsWith('TJ') && !key.startsWith('TJM')) return 'Estadual';
    if (key.startsWith('TRT')) return 'Trabalhista';
    if (key.startsWith('TRE')) return 'Eleitoral';
    if (key.startsWith('TJM')) return 'Militar';
    return 'Outro';
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b bg-muted/30">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    'text-xs font-medium',
                    getTribunalColor(getTribunalCategory(tribunal))
                  )}
                >
                  {tribunal}
                </Badge>
                {process.grau && (
                  <Badge variant="secondary" className="text-xs">
                    {process.grau}
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg">{process.numeroProcesso}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={copyProcessNumber}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </SheetTitle>
              <SheetDescription className="text-left">
                {process.classe?.nome || 'Classe não informada'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Quick info cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs font-medium">Ajuizamento</span>
                </div>
                <p className="text-sm font-medium">{formatDate(process.dataAjuizamento)}</p>
              </div>
              {process.valorCausa !== undefined && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="h-4 w-4" />
                    <span className="text-xs font-medium">Valor da Causa</span>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(process.valorCausa)}</p>
                </div>
              )}
            </div>

            {/* Court info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Órgão Julgador
              </h3>
              <p className="text-sm text-muted-foreground pl-6">
                {process.orgaoJulgador?.nome || 'Não informado'}
              </p>
            </div>

            <Separator />

            {/* Subjects */}
            {process.assuntos && process.assuntos.length > 0 && (
              <>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    Assuntos ({process.assuntos.length})
                  </h3>
                  <div className="flex flex-wrap gap-2 pl-6">
                    {process.assuntos.map((assunto, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {assunto.nome}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Movements */}
            <Accordion type="single" collapsible defaultValue="movements">
              <AccordionItem value="movements" className="border-none">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Movimentações ({process.movimentos?.length || 0})
                  </h3>
                </AccordionTrigger>
                <AccordionContent>
                  <MovementTimeline
                    movements={process.movimentos || []}
                    maxItems={15}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
