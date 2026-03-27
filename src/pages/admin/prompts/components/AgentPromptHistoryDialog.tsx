import { useState, useEffect } from 'react';
import { History, RotateCcw, GitCompareArrows } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useAgentPromptVersions, AgentPromptVersion } from '../hooks/useAgentPromptVersions';
import { AgentPrompt } from '../hooks/useAgentPrompts';
import { DiffViewer } from './DiffViewer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AgentPromptHistoryDialogProps {
  prompt: AgentPrompt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: AgentPromptVersion) => void;
}

export function AgentPromptHistoryDialog({ prompt, open, onOpenChange, onRestore }: AgentPromptHistoryDialogProps) {
  const { versions, isLoading, fetchVersions } = useAgentPromptVersions();
  const [selectedVersion, setSelectedVersion] = useState<AgentPromptVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [restoring, setRestoring] = useState<AgentPromptVersion | null>(null);

  useEffect(() => {
    if (open && prompt) {
      fetchVersions(prompt.id);
      setSelectedVersion(null);
      setShowDiff(false);
    }
  }, [open, prompt, fetchVersions]);

  const getSnapshotPromptText = (v: AgentPromptVersion): string => {
    const snap = v.snapshot as any;
    return snap?.prompt?.generated_prompt || '';
  };

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
              Histórico — [{prompt?.cod_agent}] {prompt?.agent_name}
            </DialogTitle>
            <DialogDescription>Versões anteriores deste prompt</DialogDescription>
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
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Prompt Gerado</p>
                        <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-[200px] overflow-y-auto whitespace-pre-wrap">
                          {getSnapshotPromptText(v) || 'Nenhum prompt gerado nesta versão.'}
                        </div>
                      </div>
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
                      {showDiff && prompt && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Diff — Prompt Gerado</p>
                          <DiffViewer
                            oldText={getSnapshotPromptText(v)}
                            newText={prompt.generated_prompt || ''}
                            oldLabel={`Versão #${v.version_number}`}
                            newLabel="Versão atual"
                          />
                        </div>
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
