import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Plus, RefreshCw, Search, Trash2, AlertCircle, MessageSquare, FileText, Image, Video, MapPin, Type, Ban } from "lucide-react";
import { useWabaQueues, useWabaTemplatesCache, useSyncTemplates, useDeleteTemplate } from "./useWabaTemplates";
import { TemplateBuilderDialog } from "./TemplateBuilderDialog";
import { HeaderTypesReferenceDialog } from "./HeaderTypesReferenceDialog";
import type { WabaStatus, WabaTemplateRow } from "./types";

const STATUS_VARIANT: Record<WabaStatus, { label: string; cls: string }> = {
  APPROVED: { label: "Ativo", cls: "bg-green-100 text-green-800 border-green-300" },
  PENDING: { label: "Em análise", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  REJECTED: { label: "Rejeitado", cls: "bg-red-100 text-red-800 border-red-300" },
  PAUSED: { label: "Pausado", cls: "bg-orange-100 text-orange-800 border-orange-300" },
  DISABLED: { label: "Desativado", cls: "bg-gray-100 text-gray-800 border-gray-300" },
  IN_APPEAL: { label: "Em apelação", cls: "bg-blue-100 text-blue-800 border-blue-300" },
};

type HeaderFormat = "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";

const HEADER_BADGE: Record<HeaderFormat | "NONE", { label: string; cls: string; icon: React.ElementType }> = {
  NONE: { label: "Sem cabeçalho", cls: "bg-slate-100 text-slate-700 border-slate-200", icon: Ban },
  TEXT: { label: "Texto", cls: "bg-blue-100 text-blue-700 border-blue-200", icon: Type },
  IMAGE: { label: "Imagem", cls: "bg-purple-100 text-purple-700 border-purple-200", icon: Image },
  VIDEO: { label: "Vídeo", cls: "bg-rose-100 text-rose-700 border-rose-200", icon: Video },
  DOCUMENT: { label: "Documento", cls: "bg-amber-100 text-amber-700 border-amber-200", icon: FileText },
  LOCATION: { label: "Localização", cls: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: MapPin },
};

function getHeaderInfo(t: WabaTemplateRow) {
  const header = (t.components || []).find((c: any) => c.type === "HEADER");
  if (!header) return HEADER_BADGE.NONE;
  const format = (header.format || "TEXT") as HeaderFormat | "NONE";
  return HEADER_BADGE[format] || HEADER_BADGE.NONE;
}

export function WabaTemplatesPanel() {
  const { data: queues, isLoading: loadingQueues } = useWabaQueues();
  const [queueId, setQueueId] = useState<string>("");
  const selectedQueue = queues?.find((q) => q.id === queueId);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLanguage, setFilterLanguage] = useState<string>("all");
  const [showBuilder, setShowBuilder] = useState(false);

  const { data: templates, isLoading } = useWabaTemplatesCache(queueId || null);
  const sync = useSyncTemplates();
  const del = useDeleteTemplate();

  // auto-select first queue
  useMemo(() => {
    if (!queueId && queues && queues.length > 0) setQueueId(queues[0].id);
  }, [queues, queueId]);

  // auto-sync ao escolher fila pela 1ª vez (cache vazio)
  useMemo(() => {
    if (queueId && templates && templates.length === 0 && !sync.isPending) {
      sync.mutate(queueId);
    }
    // eslint-disable-next-line
  }, [queueId]);

  const filtered = useMemo(() => {
    return (templates || []).filter((t) => {
      if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterLanguage !== "all" && t.language !== filterLanguage) return false;
      return true;
    });
  }, [templates, search, filterCategory, filterStatus, filterLanguage]);

  const previewBody = (t: WabaTemplateRow) => {
    const body = (t.components || []).find((c: any) => c.type === "BODY");
    return (body as any)?.text?.slice(0, 60) || "";
  };

  if (loadingQueues) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!queues || queues.length === 0) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Nenhuma fila WABA conectada</AlertTitle>
        <AlertDescription>
          Conecte uma fila do tipo WhatsApp Business (API oficial) em <b>Canais</b> para gerenciar templates.
        </AlertDescription>
      </Alert>
    );
  }

  const languages = Array.from(new Set((templates || []).map((t) => t.language)));

  return (
    <div className="space-y-4">
      {/* Header com seletor de fila */}
      <Card className="p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label className="text-xs text-muted-foreground">Fila WABA</label>
            <Select value={queueId} onValueChange={setQueueId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {queues.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                      {q.name} {q.phone_number && <span className="text-xs text-muted-foreground">· {q.phone_number}</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedQueue && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>WABA ID: <code className="bg-muted px-1 rounded">{selectedQueue.waba_id}</code></div>
              {selectedQueue.waba_number_id && (
                <div>Phone Number ID: <code className="bg-muted px-1 rounded">{selectedQueue.waba_number_id}</code></div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
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
          onClick={() => queueId && sync.mutate(queueId)}
          disabled={sync.isPending}
          title="Sincronizar com a Meta"
        >
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
        </Button>
        <Button onClick={() => setShowBuilder(true)} disabled={!queueId}>
          <Plus className="h-4 w-4 mr-1" /> Criar modelo
        </Button>
        <HeaderTypesReferenceDialog />
      </div>

      {/* Tabela */}
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
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                {(templates || []).length === 0 ? "Nenhum template cadastrado nesta fila." : "Nenhum resultado para os filtros."}
              </TableCell></TableRow>
            ) : filtered.map((t) => {
              const sv = STATUS_VARIANT[t.status] || STATUS_VARIANT.PENDING;
              const hb = getHeaderInfo(t);
              const HeaderIcon = hb.icon;
              return (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    {previewBody(t) && (
                      <div className="text-xs text-muted-foreground truncate max-w-xs">{previewBody(t)}</div>
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
                    {t.rejection_reason && (
                      <div className="text-xs text-red-600 mt-1">{t.rejection_reason}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.last_edited_at ? new Date(t.last_edited_at).toLocaleDateString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-red-600 rounded-full">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir template "{t.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação remove o template <b>{t.name} ({t.language})</b> da Meta e não pode ser desfeita. Templates em uso por mensagens ativas podem ser bloqueados pela Meta.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => del.mutate({ queue_id: t.queue_id, name: t.name, hsm_id: t.meta_template_id })}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {queueId && (
        <TemplateBuilderDialog
          open={showBuilder}
          onOpenChange={setShowBuilder}
          queueId={queueId}
        />
      )}
    </div>
  );
}
