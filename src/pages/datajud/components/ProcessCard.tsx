import { Calendar, Building2, Scale, ArrowRight, ChevronRight, Eye } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ProcessHit } from '../types';
import { formatDate, getTribunalColor } from '../utils';

interface ProcessCardProps {
  hit: ProcessHit;
  tribunalKey: string;
  onViewDetails: (hit: ProcessHit, tribunal: string) => void;
  onMonitor?: (processNumber: string, tribunal: string) => void;
}

export function ProcessCard({ hit, tribunalKey, onViewDetails, onMonitor }: ProcessCardProps) {
  const process = hit._source;
  const lastMovement = process.movimentos?.[0];
  
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
    <Card
      className={cn(
        'group hover:shadow-lg transition-all duration-300 cursor-pointer',
        'border-2 hover:border-primary/30',
        'bg-card/50 backdrop-blur-sm'
      )}
      onClick={() => onViewDetails(hit, tribunalKey)}
    >
      <CardContent className="p-5">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={cn('text-xs font-medium', getTribunalColor(getTribunalCategory(tribunalKey)))}>
                  {tribunalKey}
                </Badge>
                {process.grau && <Badge variant="secondary" className="text-xs">{process.grau}</Badge>}
              </div>
              <p className="font-mono text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                {process.numeroProcesso}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {onMonitor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Monitorar processo"
                  onClick={(e) => { e.stopPropagation(); onMonitor(process.numeroProcesso, tribunalKey); }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Scale className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{process.classe?.nome || 'Classe não informada'}</span>
            </div>
            {process.assuntos?.[0] && (
              <p className="text-sm text-muted-foreground pl-6 truncate">
                {process.assuntos[0].nome}
                {process.assuntos.length > 1 && ` (+${process.assuntos.length - 1})`}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{process.orgaoJulgador?.nome || 'Órgão não informado'}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>Ajuizado em {formatDate(process.dataAjuizamento)}</span>
          </div>

          {lastMovement && (
            <div className="pt-3 border-t">
              <div className="flex items-start gap-2">
                <ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{lastMovement.nome}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(lastMovement.dataHora)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
