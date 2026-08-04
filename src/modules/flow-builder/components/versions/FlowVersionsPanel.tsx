import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFlowVersions, useRestoreFlowVersion } from '../../hooks/useFlowVersions';

interface FlowVersionsPanelProps {
  flowId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  readOnly: boolean;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  published: { label: 'Publicada', className: 'border-emerald-500/40 text-emerald-600' },
  archived: { label: 'Arquivada', className: 'border-muted text-muted-foreground' },
  draft: { label: 'Rascunho', className: 'border-amber-500/40 text-amber-600' },
};

export function FlowVersionsPanel({ flowId, open, onOpenChange, readOnly }: FlowVersionsPanelProps) {
  const { data: versions = [], isLoading } = useFlowVersions(flowId, { enabled: open });
  const restore = useRestoreFlowVersion();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Versões</SheetTitle>
          <SheetDescription>
            Cada publicação gera uma versão. Você pode carregar uma versão antiga como rascunho, testar em
            simulação e publicar novamente.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="-mx-2 flex-1 px-2">
          <div className="space-y-2 pb-6">
            {isLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!isLoading && versions.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Nenhuma versão publicada ainda.
              </p>
            )}
            {versions.map((version) => {
              const meta = STATUS_LABEL[version.status] ?? STATUS_LABEL.archived;
              return (
                <div key={version.id} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium">Versão {version.version}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(version.created_at).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}{' '}
                      · {version.nodes.length} bloco(s)
                    </p>
                    {version.notes && <p className="truncate text-[11px] text-muted-foreground">{version.notes}</p>}
                  </div>
                  <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.className)}>
                    {meta.label}
                  </Badge>
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-full"
                      title="Carregar como rascunho"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate(version)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}