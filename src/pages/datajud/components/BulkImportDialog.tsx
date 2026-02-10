import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { parseBulkImportLine, type BulkImportLine } from '../types';
import { useMonitoredProcesses } from '../hooks/useMonitoredProcesses';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<BulkImportLine[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const { addBulk } = useMonitoredProcesses();

  const handleParse = useCallback(() => {
    const lines = text.split('\n').filter(l => l.trim());
    const results = lines.map((line, i) => parseBulkImportLine(line, i + 1));
    setParsed(results);
    setStep('preview');
  }, [text]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setText(content);
    };
    reader.readAsText(file);
  }, []);

  const validLines = parsed.filter(l => l.valid);
  const invalidLines = parsed.filter(l => !l.valid);

  const handleImport = () => {
    addBulk.mutate(
      validLines.map(l => ({
        process_number: l.processNumberClean,
        process_number_formatted: l.processNumber,
        name: l.name,
        client_phone: l.phone || undefined,
      })),
      {
        onSuccess: () => {
          onOpenChange(false);
          setText('');
          setParsed([]);
          setStep('input');
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setText('');
    setParsed([]);
    setStep('input');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar Lista de Processos
          </DialogTitle>
          <DialogDescription>
            Cole a lista ou faça upload de um arquivo CSV
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg font-mono">
              Formato: número, nome, telefone (um por linha)<br />
              Ex: 00100747420265150062, Joazinho trinta, 5534988860163
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole aqui a lista de processos..."
              rows={8}
              className="font-mono text-sm"
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <FileText className="h-4 w-4 mr-2" />
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,.txt"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Badge variant="default">{validLines.length} válidos</Badge>
              {invalidLines.length > 0 && (
                <Badge variant="destructive">{invalidLines.length} inválidos</Badge>
              )}
            </div>
            <ScrollArea className="h-[300px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((line) => (
                    <TableRow key={line.line} className={line.valid ? '' : 'bg-destructive/5'}>
                      <TableCell className="text-xs">{line.line}</TableCell>
                      <TableCell>
                        {line.valid ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {line.processNumber || '-'}
                        {line.error && <p className="text-destructive text-xs">{line.error}</p>}
                      </TableCell>
                      <TableCell className="text-sm">{line.name || '-'}</TableCell>
                      <TableCell className="text-sm">{line.phone || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {step === 'preview' && (
            <Button variant="outline" onClick={() => setStep('input')}>Voltar</Button>
          )}
          <Button variant="outline" onClick={handleClose}>Cancelar</Button>
          {step === 'input' ? (
            <Button onClick={handleParse} disabled={!text.trim()}>Validar</Button>
          ) : (
            <Button onClick={handleImport} disabled={validLines.length === 0 || addBulk.isPending}>
              {addBulk.isPending ? 'Importando...' : `Importar ${validLines.length} processos`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
