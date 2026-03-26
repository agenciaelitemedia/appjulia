import { useState, useEffect } from 'react';
import { History, RotateCcw, GitCompareArrows } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useTemplateVersions, TemplateVersion } from '../hooks/useTemplateVersions';
import { Template } from '../hooks/useTemplates';
import { DiffViewer } from './DiffViewer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TemplateHistoryDialogProps {
  template: Template | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: TemplateVersion) => void;
}

export function TemplateHistoryDialog({ template, open, onOpenChange, onRestore }: TemplateHistoryDialogProps) {
  const { versions, isLoading, fetchVersions } = useTemplateVersions();
  const [selectedVersion, setSelectedVersion] = useState<TemplateVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [restoring, setRestoring] = useState<TemplateVersion | null>(null);

  useEffect(() => {
    if (open && template) {
      fetchVersions(template.id);
      setSelectedVersion(null);
      setShowDiff(false);
    }
  }, [open, template, fetchVersions]);

  const handleRestore = () => {
    if (restoring) {
      onRestore(restoring);
      setRestoring(null);
      onOpenChange(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico — {template?.name}
            </DialogTitle>
            <DialogDescription>Veja as versões anteriores deste template</DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : versions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma versão anterior encontrada.</p>
          ) : (
            <div className="space-y-3">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-muted/50 ${
                    selectedVersion?.id === v.id ? 'border-primary bg-muted/30' : ''
                  }`}
                  onClick={() => {
                    setSelectedVersion(selectedVersion?.id === v.id ? null : v);
                    setShowDiff(false);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sm">Versão #{v.version_number}</span>
                      <span className="text-[11px] text-muted-foreground/70 ml-2">
                        {format(new Date(v.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {v.changed_by ? ` por ${v.changed_by}` : ''}
                      </span>
                    </div>
                    {v.change_summary && (
                      <span className="text-[11px] text-muted-foreground/70 bg-muted px-2 py-0.5 rounded">
                        {v.change_summary}
                      </span>
                    )}
                  </div>

                  {selectedVersion?.id === v.id && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Prompt</p>
                        <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                          {v.prompt_text}
                        </div>
                      </div>
                      {v.closing_model_text && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Modelo de Fechamento</p>
                          <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                            {v.closing_model_text}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); setShowDiff(!showDiff); }}
                        >
                          <GitCompareArrows className="h-3.5 w-3.5 mr-1" />
                          {showDiff ? 'Ocultar diff' : 'Comparar com atual'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); setRestoring(v); }}
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Restaurar esta versão
                        </Button>
                      </div>
                      {showDiff && template && (
                        <DiffViewer
                          oldText={v.prompt_text}
                          newText={template.prompt_text}
                          oldLabel={`Versão #${v.version_number}`}
                          newLabel="Versão atual"
                        />
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!restoring} onOpenChange={(o) => !o && setRestoring(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Versão #{restoring?.version_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo atual será substituído pelo desta versão. Uma nova entrada no histórico será criada automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={handleRestore}>Sim, Restaurar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
