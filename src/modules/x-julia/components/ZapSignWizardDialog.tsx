import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, FileSignature, FlaskConical, Link2, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useXJZapsignMutations, useXJZapsignTemplate, type XJZapsignTemplate } from '../hooks/useXJZapsign';
import {
  XJ_CONTRACT_FIELD_CATALOG,
  XJ_CONTRACT_SYSTEM_FIELDS,
  extraContractFields,
  previewSystemField,
  type XJContractField,
} from '../lib/contractFieldCatalog';

const STEPS = [
  { id: 'token', label: 'Token', icon: ShieldCheck },
  { id: 'modelo', label: 'Modelo', icon: Upload },
  { id: 'variaveis', label: 'Variáveis', icon: Link2 },
] as const;

/** Acima disso o ZapSign aceita o upload mas falha ao converter o modelo (contrato sai vazio). */
const MAX_DOCX_MB = 8;
const MAX_DOCX_BYTES = MAX_DOCX_MB * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.split(',').pop() ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ZapSignWizardDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  caseId,
  caseName,
  agentId,
  extraFields,
  mode = 'create',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  caseId: string;
  caseName: string;
  agentId?: string | null;
  extraFields?: XJContractField[];
  mode?: 'create' | 'edit';
}) {
  const { data: current } = useXJZapsignTemplate(caseId);
  const { validateToken, uploadTemplate, saveMapping, testMapping, deactivateTemplate } = useXJZapsignMutations();

  const [step, setStep] = useState(0);
  const [token, setToken] = useState('');
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [template, setTemplate] = useState<XJZapsignTemplate | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    unmapped?: string[];
    sign_url?: string | null;
    error?: string;
  } | null>(null);

  // Reseta o passo só quando o diálogo abre — não a cada refetch de `current`
  // (subir o modelo invalida a query e recarrega `current` com o diálogo ainda aberto).
  useEffect(() => {
    if (!open) return;
    // Modo edição: já existe modelo ativo — abre direto no mapeamento de variáveis.
    setStep(mode === 'edit' && current ? 2 : 0);
    setToken('');
    setTokenStatus('idle');
    setFile(null);
    setTemplate(current ?? null);
    setMapping(current?.field_mapping ?? {});
    setTestResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fieldOptions: XJContractField[] = [...XJ_CONTRACT_FIELD_CATALOG, ...extraContractFields(extraFields ?? [])];

  const handleTestToken = async () => {
    const result = await validateToken.mutateAsync({ token: token.trim() });
    setTokenStatus(result.ok ? 'ok' : 'error');
  };

  const handleUpload = async () => {
    if (!file) return;
    if (file.size > MAX_DOCX_BYTES) {
      toast.error(
        `O arquivo tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O ZapSign não converte modelos acima de ${MAX_DOCX_MB} MB — comprima ou remova as imagens do .docx.`,
      );
      return;
    }
    const base64Docx = await fileToBase64(file);
    const created = await uploadTemplate.mutateAsync({
      client_id: clientId,
      client_name: clientName,
      case_id: caseId,
      agent_id: agentId ?? null,
      case_name: caseName,
      base64_docx: base64Docx,
      token: token.trim() || undefined,
    });
    setTemplate(created);
    // Ao trocar o arquivo, preserva o mapeamento das variáveis que continuam existindo.
    const names = new Set(created.variables.map((v) => v.variable));
    setMapping((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => names.has(k))));
    setStep(2);
  };

  const handleRemoveTemplate = async () => {
    if (!template) return;
    await deactivateTemplate.mutateAsync({ id: template.id, case_id: caseId });
    setTemplate(null);
    setMapping({});
    onOpenChange(false);
  };

  const handleSaveMapping = async () => {
    if (!template) return;
    await saveMapping.mutateAsync({ id: template.id, case_id: caseId, field_mapping: mapping });
    onOpenChange(false);
  };

  const handleTestMapping = async () => {
    if (!template) return;
    setTestResult(null);
    // Salva antes para o teste refletir exatamente o que ficará valendo no contrato real.
    await saveMapping.mutateAsync({ id: template.id, case_id: caseId, field_mapping: mapping });
    const result = await testMapping.mutateAsync({
      id: template.id,
      field_mapping: mapping,
      token: token.trim() || undefined,
    });
    setTestResult(result);
    if (result.ok) {
      toast.success(
        result.unmapped?.length
          ? `Documento de teste gerado, mas ${result.unmapped.length} variável(is) ficaram vazias.`
          : 'Documento de teste gerado com todas as variáveis preenchidas.',
      );
    } else {
      toast.error(result.error || 'O ZapSign não gerou o documento de teste.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5" /> Configurar modelo no ZapSign
          </DialogTitle>
          <DialogDescription>
            Caso jurídico: <strong>{caseName}</strong>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={STEPS[step].id}>
          <TabsList className="grid w-full grid-cols-3">
            {STEPS.map((s, i) => (
              <TabsTrigger key={s.id} value={s.id} disabled={i > step} className="gap-1.5">
                <s.icon className="h-3.5 w-3.5" /> {s.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="token" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label>Token do ZapSign</Label>
              <Input
                type="password"
                autoComplete="off"
                placeholder="Deixe em branco para usar o token padrão do sistema"
                value={token}
                onChange={(e) => {
                  setToken(e.target.value);
                  setTokenStatus('idle');
                }}
              />
              <p className="text-xs text-muted-foreground">
                Por padrão usa o token padrão do sistema. Substitua aqui só se este agente especialista usar uma conta
                própria no ZapSign.
              </p>
            </div>
            {tokenStatus === 'ok' && (
              <Badge variant="outline" className="gap-1 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Token válido
              </Badge>
            )}
            {tokenStatus === 'error' && <Badge variant="destructive">Token inválido ou sem permissão</Badge>}
            <DialogFooter>
              <Button variant="outline" onClick={handleTestToken} disabled={validateToken.isPending}>
                {validateToken.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Testar conexão
              </Button>
              <Button onClick={() => setStep(1)}>Continuar</Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="modelo" className="space-y-3 pt-4">
            <div className="space-y-1.5">
              <Label>Nome do modelo</Label>
              <Input value={caseName} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Arquivo .docx do contrato (com variáveis {'{{assim}}'})</Label>
              <Input
                type="file"
                accept=".docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                O ZapSign só aceita modelos em .docx (até {MAX_DOCX_MB} MB) e extrai automaticamente as variáveis do
                arquivo. Modelos pesados (com imagens ou digitalizações) falham na conversão e o contrato não é gerado.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(0)}>Voltar</Button>
              <Button onClick={handleUpload} disabled={!file || uploadTemplate.isPending}>
                {uploadTemplate.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Enviar ao ZapSign
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="variaveis" className="space-y-3 pt-4">
            {template ? (
              <>
                <p className="text-xs text-muted-foreground">
                  Pasta no ZapSign: <code>{template.folder_path}</code> · {template.variables.length} variável(is)
                  encontrada(s) no modelo. Vincule cada uma a um campo do caso.
                </p>
                <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 p-2 text-xs">
                  <span>
                    Modelo: <strong>{template.template_name}</strong>
                  </span>
                  <span className="text-muted-foreground">
                    · atualizado em {new Date(template.updated_at).toLocaleString('pt-BR')}
                  </span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setStep(1)}>
                      <Upload className="mr-1.5 h-3.5 w-3.5" /> Trocar arquivo
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={handleRemoveTemplate}
                      disabled={deactivateTemplate.isPending}
                    >
                      {deactivateTemplate.isPending ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Remover modelo
                    </Button>
                  </div>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {template.variables.map((v) => (
                    <div key={v.variable} className="flex items-center gap-2 rounded-md border p-2">
                      <div className="min-w-0 flex-1">
                        <code className="block truncate text-xs">{v.variable}</code>
                        {previewSystemField(mapping[v.variable] ?? '') && (
                          <span className="text-[11px] text-muted-foreground">
                            → {previewSystemField(mapping[v.variable] ?? '')}
                          </span>
                        )}
                      </div>
                      <Select
                        value={mapping[v.variable] ?? '__ignore__'}
                        onValueChange={(value) =>
                          setMapping((prev) => {
                            const next = { ...prev };
                            if (value === '__ignore__') delete next[v.variable];
                            else next[v.variable] = value;
                            return next;
                          })
                        }
                      >
                        <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__ignore__">Ignorar</SelectItem>
                          <SelectGroup>
                            <SelectLabel>Automáticas do sistema</SelectLabel>
                            {XJ_CONTRACT_SYSTEM_FIELDS.map((f) => (
                              <SelectItem key={f.key} value={f.key}>{f.label ?? f.key}</SelectItem>
                            ))}
                          </SelectGroup>
                          <SelectGroup>
                            <SelectLabel>Dados do caso</SelectLabel>
                          {fieldOptions.map((f) => (
                            <SelectItem key={f.key} value={f.key}>{f.label ?? f.key}</SelectItem>
                          ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  {template.variables.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      O ZapSign não encontrou variáveis {'{{...}}'} nesse arquivo.
                    </p>
                  )}
                </div>
                {testResult && (
                  <div
                    className={`space-y-1.5 rounded-md border p-2 text-xs ${
                      testResult.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-destructive/40 bg-destructive/5'
                    }`}
                  >
                    <p className="flex items-center gap-1.5 font-medium">
                      {testResult.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {testResult.ok ? 'Documento de teste gerado no ZapSign' : 'Falha no teste'}
                    </p>
                    {testResult.error && <p className="text-muted-foreground">{testResult.error}</p>}
                    {!!testResult.unmapped?.length && (
                      <p className="text-muted-foreground">
                        Sem valor: <code>{testResult.unmapped.join(', ')}</code>
                      </p>
                    )}
                    {testResult.ok && !testResult.unmapped?.length && (
                      <p className="text-muted-foreground">Todas as variáveis do modelo retornaram valor.</p>
                    )}
                    {testResult.sign_url && (
                      <a
                        href={testResult.sign_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Abrir documento de teste
                      </a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum modelo enviado ainda.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
              <Button
                variant="outline"
                onClick={handleTestMapping}
                disabled={!template || testMapping.isPending || saveMapping.isPending}
              >
                {testMapping.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <FlaskConical className="mr-1.5 h-4 w-4" />
                )}
                Testar envio
              </Button>
              <Button onClick={handleSaveMapping} disabled={!template || saveMapping.isPending}>
                {saveMapping.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Salvar mapeamento
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
