import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AlertCircle, Ban, FileText, Image as ImageIcon, Loader2, MapPin, MessageSquare,
  Plus, RefreshCw, Search, Trash2, Type, Video,
} from 'lucide-react';
import {
  HeaderTypesReferenceDialog, TemplateBuilderDialog, useDeleteTemplate,
  useSyncTemplates, useWabaQueues, useWabaTemplatesCache,
  type WabaStatus, type WabaTemplateRow,
} from '../extend/wabaTemplates';

const STATUS_VARIANT: Record<WabaStatus, { label: string; cls: string }> = {
  APPROVED: { label: 'Ativo', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  PENDING: { label: 'Em análise', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  REJECTED: { label: 'Rejeitado', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
  PAUSED: { label: 'Pausado', cls: 'bg-orange-500/10 text-orange-700 border-orange-500/30' },
  DISABLED: { label: 'Desativado', cls: 'bg-muted text-muted-foreground border-border' },
  IN_APPEAL: { label: 'Em apelação', cls: 'bg-primary/10 text-primary border-primary/30' },
};

type HeaderFormat = 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'LOCATION';

const HEADER_BADGE: Record<HeaderFormat | 'NONE', { label: string; cls: string; icon: React.ElementType }> = {
  NONE: { label: 'Sem cabeçalho', cls: 'bg-muted text-muted-foreground border-border', icon: Ban },
  TEXT: { label: 'Texto', cls: 'bg-primary/10 text-primary border-primary/30', icon: Type },
  IMAGE: { label: 'Imagem', cls: 'bg-purple-500/10 text-purple-700 border-purple-500/30', icon: ImageIcon },
  VIDEO: { label: 'Vídeo', cls: 'bg-rose-500/10 text-rose-700 border-rose-500/30', icon: Video },
  DOCUMENT: { label: 'Documento', cls: 'bg-amber-500/10 text-amber-700 border-amber-500/30', icon: FileText },
  LOCATION: { label: 'Localização', cls: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30', icon: MapPin },
};

function getHeaderInfo(t: WabaTemplateRow) {
  const header = (t.components || []).find((c: any) => c.type === 'HEADER');
  if (!header) return HEADER_BADGE.NONE;
  const format = ((header as any).format || 'TEXT') as HeaderFormat | 'NONE';
  return HEADER_BADGE[format] || HEADER_BADGE.NONE;
}

function previewBody(t: WabaTemplateRow) {
  const body = (t.components || []).find((c: any) => c.type === 'BODY');
  return (body as any)?.text?.slice(0, 70) || '';
}

export function OfficialTemplatesPanel({ canEdit }: { canEdit: boolean }) {
  const { data: queues, isLoading: loadingQueues } = useWabaQueues();
  const [queueId, setQueueId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: templates, isLoading } = useWabaTemplatesCache(queueId || null);
  const sync = useSyncTemplates();
  const del = useDeleteTemplate();

  const selectedQueue = queues?.find((q) => q.id === queueId);

  useEffect(() => {
    if (!queueId && queues && queues.length > 0) setQueueId(queues[0].id);
  }, [queues, queueId]);

  const filtered = useMemo(() => {
    return (templates || []).filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (filterStatus !== 'all' && t.status !== filterStatus) return false;
      if (filterLanguage !== 'all' && t.language !== filterLanguage) return false;
      return true;
    });
  }, [templates, search, filterCategory, filterStatus, filterLanguage]);

  if (loadingQueues) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!queues || queues.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Nenhum número de API Oficial conectado</AlertTitle>
        <AlertDescription>
          Conecte uma fila do tipo WhatsApp Business (API oficial) para criar e gerenciar templates
          aprovados pela Meta.
        </AlertDescription>
      </Alert>
    );
  }

  const languages = Array.from(new Set((templates || []).map((t) => t.language)));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Número (fila API Oficial)</Label>
              <Select value={queueId} onValueChange={setQueueId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {queues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        {q.name}
                        {q.phone_number && (
                          <span className="text-xs text-muted-foreground">· {q.phone_number}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedQueue && (
              <div className="space-y-0.5 text-xs text-muted-foreground">
                <div>WABA ID: <code className="rounded bg-muted px-1">{selectedQueue.waba_id}</code></div>
                {selectedQueue.waba_number_id && (
                  <div>Phone Number ID: <code className="rounded bg-muted px-1">{selectedQueue.waba_number_id}</code></div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="MARKETING">Marketing</SelectItem>
            <SelectItem value="UTILITY">Utilidade</SelectItem>
            <SelectItem value="AUTHENTICATION">Autenticação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            {Object.entries(STATUS_VARIANT).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterLanguage} onValueChange={setFilterLanguage}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Idioma" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos idiomas</SelectItem>
            {languages.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={() => queueId && sync.mutate(queueId)}
          disabled={sync.isPending || !queueId}
          title="Sincronizar com a Meta"
        >
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? 'animate-spin' : ''}`} />
        </Button>
        {canEdit && (
          <Button className="gap-2" onClick={() => setShowBuilder(true)} disabled={!queueId}>
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        )}
        <HeaderTypesReferenceDialog />
      </div>

      <p className="text-xs text-muted-foreground">
        Templates da API Oficial passam por aprovação da <b>Meta</b>. Você pode usar cabeçalho com
        mídia (imagem, vídeo, documento ou localização), rodapé e botões.
      </p>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome do modelo</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Cabeçalho</TableHead>
              <TableHead>Idioma</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Última edição</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {(templates || []).length === 0
                    ? 'Nenhum template cadastrado neste número.'
                    : 'Nenhum resultado para os filtros.'}
                </TableCell>
              </TableRow>
            ) : filtered.map((t) => {
              const sv = STATUS_VARIANT[t.status] || STATUS_VARIANT.PENDING;
              const hb = getHeaderInfo(t);
              const HeaderIcon = hb.icon;
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {previewBody(t) && (
                      <div className="max-w-xs truncate text-xs text-muted-foreground">{previewBody(t)}</div>
                    )}
                  </TableCell>
                  <TableCell className="capitalize">{t.category.toLowerCase()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 font-medium ${hb.cls}`}>
                      <HeaderIcon className="h-3 w-3" />
                      {hb.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{t.language}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={sv.cls}>{sv.label}</Badge>
                    {t.rejection_reason && t.rejection_reason !== 'NONE' && (
                      <div className="mt-1 text-xs text-destructive">{t.rejection_reason}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.last_edited_at ? new Date(t.last_edited_at).toLocaleDateString('pt-BR') : '-'}
                  </TableCell>
                  <TableCell>
                    {canEdit && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="outline" className="h-7 w-7 rounded-full bg-destructive/10" title="Excluir">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir template "{t.name}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação remove o template <b>{t.name} ({t.language})</b> da Meta e não pode
                              ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => del.mutate({ queue_id: t.queue_id, name: t.name, hsm_id: t.meta_template_id })}
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {queueId && (
        <TemplateBuilderDialog open={showBuilder} onOpenChange={setShowBuilder} queueId={queueId} />
      )}
    </div>
  );
}
