import { useState, useEffect } from 'react';
import { History, RotateCcw, GitCompareArrows } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { useLegalCaseVersions, LegalCaseVersion } from '../hooks/useLegalCaseVersions';
import { LegalCase } from '../hooks/useLegalCases';
import { DiffViewer } from './DiffViewer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LegalCaseHistoryDialogProps {
  legalCase: LegalCase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: LegalCaseVersion) => void;
}

export function LegalCaseHistoryDialog({ legalCase, open, onOpenChange, onRestore }: LegalCaseHistoryDialogProps) {
  const { versions, isLoading, fetchVersions } = useLegalCaseVersions();
  const [selectedVersion, setSelectedVersion] = useState<LegalCaseVersion | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const [restoring, setRestoring] = useState<LegalCaseVersion | null>(null);

  useEffect(() => {
    if (open && legalCase) {
      fetchVersions(legalCase.id);
      setSelectedVersion(null);
      setShowDiff(false);
    }
  }, [open, legalCase, fetchVersions]);

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
              Histórico — {legalCase?.case_name}
            </DialogTitle>
            <DialogDescription>Veja as versões anteriores deste caso jurídico</DialogDescription>
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
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Informações do Caso</p>
                        <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                          {v.case_info || '(vazio)'}
                        </div>
                      </div>
                      {v.qualification_script && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Roteiro de Qualificação</p>
                          <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                            {v.qualification_script}
                          </div>
                        </div>
                      )}
                      {v.fees_info && (
                        <div>
                          <p className="text-[11px] font-semibold text-muted-foreground mb-1">Honorários</p>
                          <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-[150px] overflow-y-auto whitespace-pre-wrap">
                            {v.fees_info}
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
                      {showDiff && legalCase && (
                        <div className="space-y-4">
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Diff — Informações do Caso</p>
                            <DiffViewer
                              oldText={v.case_info || ''}
                              newText={legalCase.case_info || ''}
                              oldLabel={`Versão #${v.version_number}`}
                              newLabel="Versão atual"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Diff — Roteiro de Qualificação</p>
                            <DiffViewer
                              oldText={v.qualification_script || ''}
                              newText={legalCase.qualification_script || ''}
                              oldLabel={`Versão #${v.version_number}`}
                              newLabel="Versão atual"
                            />
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Diff — Honorários</p>
                            <DiffViewer
                              oldText={v.fees_info || ''}
                              newText={legalCase.fees_info || ''}
                              oldLabel={`Versão #${v.version_number}`}
                              newLabel="Versão atual"
                            />
                          </div>
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
