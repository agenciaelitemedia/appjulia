import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileText, CheckCircle2, AlertTriangle, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { CRMCustomField } from '../../hooks/useCRMCustomFields';
import type { CRMDeal, CRMPipeline } from '../../types';
import { useImportDealsCsv } from '../../hooks/useImportDealsCsv';
import {
  CSV_IGNORE,
  CSV_IMPORT_MAX_ROWS,
  DEAL_CSV_FIELDS,
  autoMapHeaders,
  buildErrorsCsv,
  buildTemplateCsv,
  downloadCsv,
  parseCsv,
  validateRows,
  type ImportRow,
} from '../../lib/csvImport';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string | null;
  clientId: string;
  codAgent: string;
  userName?: string;
  pipelines: CRMPipeline[];
  customFields: CRMCustomField[];
  deals: CRMDeal[];
  onImported: () => void;
}

type Step = 'file' | 'map' | 'preview' | 'done';

export function ImportDealsCsvDialog({
  open,
  onOpenChange,
  boardId,
  clientId,
  codAgent,
  userName,
  pipelines,
  customFields,
  deals,
  onImported,
}: Props) {
  const [step, setStep] = useState<Step>('file');
  const [rawText, setRawText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [truncated, setTruncated] = useState(false);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [pipelineId, setPipelineId] = useState<string>('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [summary, setSummary] = useState<Awaited<ReturnType<ReturnType<typeof useImportDealsCsv>['run']>> | null>(null);

  const { run, isRunning, progress } = useImportDealsCsv({ boardId, clientId, codAgent, userName });

  const activePipelines = useMemo(
    () => pipelines.filter((p) => p.is_active !== false).sort((a, b) => a.position - b.position),
    [pipelines],
  );

  const validation = useMemo(() => {
    if (dataRows.length === 0) return null;
    return validateRows({
      headers,
      rows: dataRows,
      mapping,
      customFields,
      existing: deals.map((d) => ({ contact_phone: d.contact_phone, contact_email: d.contact_email })),
      skipDuplicates,
    });
  }, [headers, dataRows, mapping, customFields, deals, skipDuplicates]);

  const hasTitleSource = useMemo(
    () => Object.values(mapping).some((v) => v === 'titulo' || v === 'nome'),
    [mapping],
  );

  const reset = () => {
    setStep('file');
    setRawText('');
    setHeaders([]);
    setDataRows([]);
    setTruncated(false);
    setMapping({});
    setSummary(null);
    setSkipDuplicates(true);
  };

  const handleClose = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setRawText(String(ev.target?.result ?? ''));
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const handleParse = () => {
    const parsed = parseCsv(rawText);
    if (parsed.headers.length === 0 || parsed.rows.length === 0) {
      toast.error('Arquivo vazio ou sem linhas de dados.');
      return;
    }
    setHeaders(parsed.headers);
    setDataRows(parsed.rows);
    setTruncated(parsed.truncated);
    setMapping(autoMapHeaders(parsed.headers, customFields));
    if (!pipelineId && activePipelines.length > 0) setPipelineId(activePipelines[0].id);
    setStep('map');
  };

  const handleImport = async () => {
    if (!validation || !pipelineId) return;
    const valid = validation.rows.filter((r) => r.status === 'valid');
    if (valid.length === 0) {
      toast.error('Nenhuma linha válida para importar.');
      return;
    }
    const pipelineDeals = deals.filter((d) => d.pipeline_id === pipelineId);
    const startPosition = pipelineDeals.length > 0
      ? Math.max(...pipelineDeals.map((d) => d.position)) + 1
      : 0;

    const result = await run({
      pipelineId,
      rows: valid,
      startPosition,
      skippedCount: validation.duplicateCount + validation.invalidCount,
    });
    setSummary(result);
    setStep('done');
    onImported();
    if (result.created > 0) toast.success(`${result.created} card(s) importado(s).`);
    if (result.failed > 0) toast.error(`${result.failed} linha(s) falharam ao gravar.`);
  };

  const targetOptions = [
    { value: CSV_IGNORE, label: '— não importar —' },
    ...DEAL_CSV_FIELDS.map((f) => ({ value: f.key, label: f.label })),
    ...customFields
      .filter((f) => f.is_visible)
      .map((f) => ({ value: `cf:${f.field_name}`, label: `${f.field_label} (adicional)` })),
  ];

  const previewRows: ImportRow[] = validation?.rows.slice(0, 60) ?? [];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importar cards de um arquivo .csv
          </DialogTitle>
          <DialogDescription>
            {step === 'file' && 'Envie o arquivo .csv ou cole o conteúdo da planilha.'}
            {step === 'map' && 'Confira as colunas, escolha a etapa de destino e as opções.'}
            {step === 'preview' && 'Revise as linhas antes de criar os cards.'}
            {step === 'done' && 'Importação concluída.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* PASSO 1 — arquivo */}
          {step === 'file' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <label className="cursor-pointer">
                    <FileText className="h-4 w-4 mr-2" />
                    Escolher arquivo .csv
                    <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                  </label>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => downloadCsv('modelo-cards-crm.csv', buildTemplateCsv(customFields))}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar modelo .csv
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="csv-text">Conteúdo do arquivo</Label>
                <Textarea
                  id="csv-text"
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                  placeholder={'titulo;nome;telefone;email;valor;prioridade\nContrato Silva;Maria Silva;34991633679;maria@exemplo.com;1.500,00;alta'}
                />
                <p className="text-xs text-muted-foreground">
                  Separador `,` ou `;` detectado automaticamente. Máximo de {CSV_IMPORT_MAX_ROWS} linhas por importação.
                </p>
              </div>
            </>
          )}

          {/* PASSO 2 — mapeamento */}
          {step === 'map' && (
            <>
              {truncated && (
                <Alert className="border-amber-500/40 bg-amber-500/5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-xs">
                    O arquivo tem mais de {CSV_IMPORT_MAX_ROWS} linhas — apenas as primeiras {CSV_IMPORT_MAX_ROWS} serão consideradas.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Etapa de destino *</Label>
                  <Select value={pipelineId} onValueChange={setPipelineId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {activePipelines.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={skipDuplicates}
                      onCheckedChange={(v) => setSkipDuplicates(v === true)}
                    />
                    Ignorar linhas duplicadas (telefone/e-mail)
                  </label>
                </div>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-1/3">Coluna do arquivo</TableHead>
                      <TableHead>Campo do card</TableHead>
                      <TableHead className="w-1/4">Exemplo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headers.map((h, index) => (
                      <TableRow key={`${h}-${index}`}>
                        <TableCell className="font-medium text-xs">{h || `(coluna ${index + 1})`}</TableCell>
                        <TableCell>
                          <Select
                            value={mapping[index] ?? CSV_IGNORE}
                            onValueChange={(v) => setMapping((prev) => ({ ...prev, [index]: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {targetOptions.map((o) => (
                                <SelectItem key={o.value} value={o.value} className="text-xs">
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">
                          {dataRows[0]?.[index] ?? ''}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {!hasTitleSource && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Mapeie ao menos uma coluna para <strong>Título</strong> ou <strong>Nome do contato</strong>.
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Quando o telefone já existir em um contato do chat, o card é criado vinculado à conversa.
                  Contatos novos não são criados pela importação.
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* PASSO 3 — prévia */}
          {step === 'preview' && validation && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  {validation.validCount} válidas
                </Badge>
                <Badge variant="outline" className="text-amber-600 border-amber-500/40">
                  {validation.duplicateCount} duplicadas
                </Badge>
                <Badge variant="outline" className="text-destructive border-destructive/40">
                  {validation.invalidCount} com erro
                </Badge>
                {(validation.invalidCount > 0 || validation.duplicateCount > 0) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => downloadCsv('linhas-nao-importadas.csv', buildErrorsCsv(validation.rows))}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Baixar relatório
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[320px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead className="w-32">Telefone</TableHead>
                      <TableHead className="w-24">Valor</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((r) => (
                      <TableRow key={r.line}>
                        <TableCell className="text-xs text-muted-foreground">{r.line}</TableCell>
                        <TableCell className="text-xs truncate max-w-[220px]">{r.data.title || '—'}</TableCell>
                        <TableCell className="text-xs">{r.data.contact_phone || '—'}</TableCell>
                        <TableCell className="text-xs">
                          {r.data.value ? r.data.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> ok
                            </span>
                          )}
                          {r.status === 'duplicate' && (
                            <span className="inline-flex items-center gap-1 text-amber-600">
                              <Copy className="h-3 w-3" /> duplicada · {r.duplicateOf}
                            </span>
                          )}
                          {r.status === 'invalid' && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertTriangle className="h-3 w-3" /> {r.errors.join('; ')}
                            </span>
                          )}
                          {r.warnings.length > 0 && r.status !== 'invalid' && (
                            <span className="block text-[11px] text-muted-foreground">{r.warnings.join('; ')}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
              {validation.rows.length > previewRows.length && (
                <p className="text-xs text-muted-foreground">
                  Mostrando as primeiras {previewRows.length} de {validation.rows.length} linhas.
                </p>
              )}

              {isRunning && (
                <div className="space-y-1">
                  <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
                  <p className="text-xs text-muted-foreground">
                    Gravando {progress.done} de {progress.total}…
                  </p>
                </div>
              )}
            </>
          )}

          {/* PASSO 4 — resumo */}
          {step === 'done' && summary && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                  {summary.created} criados
                </Badge>
                <Badge variant="outline">{summary.skipped} ignorados</Badge>
                {summary.failed > 0 && (
                  <Badge variant="outline" className="text-destructive border-destructive/40">
                    {summary.failed} falharam
                  </Badge>
                )}
                {summary.linkedToChat > 0 && (
                  <Badge variant="outline">{summary.linkedToChat} vinculados ao chat</Badge>
                )}
              </div>
              {summary.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-1">
                    {summary.errors.map((e) => (
                      <p key={e}>{e}</p>
                    ))}
                  </AlertDescription>
                </Alert>
              )}
              {validation && (validation.invalidCount > 0 || validation.duplicateCount > 0) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadCsv('linhas-nao-importadas.csv', buildErrorsCsv(validation.rows))}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar linhas não importadas
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'file' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancelar</Button>
              <Button onClick={handleParse} disabled={!rawText.trim()}>Continuar</Button>
            </>
          )}
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('file')}>Voltar</Button>
              <Button onClick={() => setStep('preview')} disabled={!pipelineId || !hasTitleSource}>
                Ver prévia
              </Button>
            </>
          )}
          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')} disabled={isRunning}>Voltar</Button>
              <Button onClick={handleImport} disabled={isRunning || !validation || validation.validCount === 0}>
                {isRunning ? 'Importando…' : `Importar ${validation?.validCount ?? 0} cards`}
              </Button>
            </>
          )}
          {step === 'done' && <Button onClick={() => handleClose(false)}>Fechar</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
