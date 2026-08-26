import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Check, Loader2, Pencil, Plus, Search, Send, Trash2, X } from 'lucide-react';
import { APPROVAL_STATUS_LABEL } from '../module';
import { useAuth } from '../extend/auth';
import {
  extractVariables, useDeleteDspTemplate, useDspTemplateReview, useDspTemplates, useSaveDspTemplate,
} from '../hooks/useDspTemplates';
import type { DspTemplate } from '../types';

const badgeVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'approved') return 'default';
  if (s === 'rejected') return 'destructive';
  if (s === 'pending') return 'secondary';
  return 'outline';
};

export function TemplatesTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { user, isAdmin } = useAuth();
  const actor = user?.id != null ? String(user.id) : null;
  const { data: templates = [], isLoading } = useDspTemplates(clientId);
  const save = useSaveDspTemplate();
  const review = useDspTemplateReview();
  const remove = useDeleteDspTemplate();

  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<DspTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('marketing');
  const [body, setBody] = useState('');
  const [rejectTarget, setRejectTarget] = useState<DspTemplate | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DspTemplate | null>(null);

  const filtered = useMemo(
    () => templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [templates, search],
  );

  const startNew = () => {
    setEditing(null);
    setName('');
    setCategory('marketing');
    setBody('');
    setOpen(true);
  };

  const startEdit = (t: DspTemplate) => {
    setEditing(t);
    setName(t.name);
    setCategory(t.category);
    setBody(t.body);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!clientId) return;
    await save.mutateAsync({
      id: editing?.id,
      client_id: String(clientId),
      name: name.trim(),
      category,
      body,
      created_by: actor,
    });
    setOpen(false);
  };

  const previewVars = extractVariables(body);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {canEdit && (
          <Button onClick={startNew} className="gap-2">
            <Plus className="h-4 w-4" /> Novo template
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Só templates <b>aprovados</b> podem ser usados nas variantes de campanha. Editar um template aprovado
        o devolve para rascunho e exige nova aprovação.
      </p>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum template cadastrado.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((t) => (
          <Card key={t.id} className="border-2">
            <CardContent className="py-4 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{t.name}</span>
                    <Badge variant={badgeVariant(t.status)}>
                      {APPROVAL_STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                    <Badge variant="outline">{t.category}</Badge>
                    {!t.is_active && <Badge variant="outline">Arquivado</Badge>}
                  </div>
                  {t.variables?.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {t.variables.map((v) => (
                        <Badge key={v} variant="secondary" className="text-[10px]">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  )}
                  {t.review_notes && (
                    <p className="text-xs text-destructive">Revisão: {t.review_notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  {canEdit && ['draft', 'rejected'].includes(t.status) && (
                    <Button
                      size="icon" variant="outline" className="h-7 w-7 rounded-full bg-primary/10"
                      title="Enviar para aprovação"
                      onClick={() => review.mutate({ id: t.id, action: 'submit', actor })}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {isAdmin && t.status === 'pending' && (
                    <>
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-emerald-500/10"
                        title="Aprovar"
                        onClick={() => review.mutate({ id: t.id, action: 'approve', actor })}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon" variant="outline" className="h-7 w-7 rounded-full bg-destructive/10"
                        title="Reprovar"
                        onClick={() => { setRejectTarget(t); setRejectNotes(''); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  {canEdit && (
                    <Button
                      size="icon" variant="outline" className="h-7 w-7 rounded-full bg-muted"
                      title="Editar" onClick={() => startEdit(t)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      size="icon" variant="outline" className="h-7 w-7 rounded-full bg-destructive/10"
                      title="Excluir" onClick={() => setDeleteTarget(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-xs text-muted-foreground">
                {t.body}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar template' : 'Novo template'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Reativação 30 dias" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="utility">Utilidade / serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Olá {{nome}}, ..." />
              <p className="text-xs text-muted-foreground">
                Variáveis detectadas: {previewVars.length > 0 ? previewVars.map((v) => `{{${v}}}`).join(', ') : 'nenhuma'}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={name.trim().length < 3 || body.trim().length < 5 || save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Reprovar template</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Textarea rows={3} value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Voltar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejectTarget) {
                  review.mutate({ id: rejectTarget.id, action: 'reject', actor, notes: rejectNotes.trim() || null });
                }
                setRejectTarget(null);
              }}
            >
              Reprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Campanhas que já usaram este template continuam com o texto salvo nas variantes. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteTarget) remove.mutate(deleteTarget.id); setDeleteTarget(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </TabsContent>

      <TabsContent value="oficial">
        <OfficialTemplatesPanel canEdit={canEdit} />
      </TabsContent>
    </Tabs>
  );
}

