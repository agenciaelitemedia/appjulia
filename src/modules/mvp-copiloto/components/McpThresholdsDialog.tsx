/**
 * Configuração dos limites de alerta do MCP (por escritório e por tool).
 * Somente o owner/admin do escritório edita; a equipe apenas visualiza.
 */
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Settings2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_THRESHOLD,
  useDeleteMcpThreshold,
  useMcpThresholds,
  useSaveMcpThreshold,
  type McpThreshold,
} from '../hooks/useMcpTelemetry';

interface Props {
  toolNames: string[];
  canEdit: boolean;
}

export function McpThresholdsDialog({ toolNames, canEdit }: Props) {
  const { data: thresholds } = useMcpThresholds();
  const save = useSaveMcpThreshold();
  const remove = useDeleteMcpThreshold();

  const [open, setOpen] = useState(false);
  const [tool, setTool] = useState('');
  const [p95, setP95] = useState(String(DEFAULT_THRESHOLD.p95_limit_ms));
  const [errRate, setErrRate] = useState(String(DEFAULT_THRESHOLD.error_rate_limit));
  const [minVol, setMinVol] = useState(String(DEFAULT_THRESHOLD.min_volume));

  const list: McpThreshold[] = thresholds || [];

  const submit = async () => {
    try {
      await save.mutateAsync({
        tool_name: tool.trim() ? tool.trim() : null,
        p95_limit_ms: Math.max(1, Number(p95) || 0),
        error_rate_limit: Math.max(0, Number(errRate) || 0),
        min_volume: Math.max(1, Number(minVol) || 1),
        enabled: true,
      });
      toast.success(tool.trim() ? `Limite salvo para ${tool.trim()}` : 'Limite padrão salvo');
      setTool('');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggle = async (row: McpThreshold) => {
    try {
      await save.mutateAsync({
        id: row.id,
        tool_name: row.tool_name,
        p95_limit_ms: row.p95_limit_ms,
        error_rate_limit: row.error_rate_limit,
        min_volume: row.min_volume,
        enabled: !row.enabled,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1">
          <Settings2 className="h-3.5 w-3.5" />
          Limites
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Limites de alerta por ferramenta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {canEdit && (
            <div className="grid gap-3 sm:grid-cols-5 items-end">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs">Ferramenta (vazio = padrão)</Label>
                <Input
                  list="mcp-tool-names"
                  value={tool}
                  onChange={(e) => setTool(e.target.value)}
                  placeholder="todas as tools"
                  className="h-8 text-xs"
                />
                <datalist id="mcp-tool-names">
                  {toolNames.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">p95 (ms)</Label>
                <Input value={p95} onChange={(e) => setP95(e.target.value)} className="h-8 text-xs" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Erro (%)</Label>
                <Input value={errRate} onChange={(e) => setErrRate(e.target.value)} className="h-8 text-xs" inputMode="numeric" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Volume mín.</Label>
                <Input value={minVol} onChange={(e) => setMinVol(e.target.value)} className="h-8 text-xs" inputMode="numeric" />
              </div>
              <Button size="sm" className="h-8 sm:col-span-5" onClick={submit} disabled={save.isPending}>
                Salvar limite
              </Button>
            </div>
          )}

          <div className="max-h-72 overflow-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ferramenta</TableHead>
                  <TableHead className="text-xs text-right">p95</TableHead>
                  <TableHead className="text-xs text-right">% erro</TableHead>
                  <TableHead className="text-xs text-right">Vol. mín.</TableHead>
                  <TableHead className="text-xs text-right">Ativo</TableHead>
                  {canEdit && <TableHead className="text-xs" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="text-center text-sm text-muted-foreground py-6">
                      Nenhum limite configurado. Sem limites, nenhum alerta é gerado.
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-xs font-mono">
                        {row.tool_name || <Badge variant="secondary" className="text-[10px]">padrão</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-right">{row.p95_limit_ms}ms</TableCell>
                      <TableCell className="text-xs text-right">{row.error_rate_limit}%</TableCell>
                      <TableCell className="text-xs text-right">{row.min_volume}</TableCell>
                      <TableCell className="text-right">
                        <Switch checked={row.enabled} onCheckedChange={() => toggle(row)} disabled={!canEdit} />
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => remove.mutate(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Somente o responsável pelo escritório pode alterar os limites.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
