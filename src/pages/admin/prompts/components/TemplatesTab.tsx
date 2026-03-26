import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Pencil, Trash2, Eye, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useTemplates, Template } from '../hooks/useTemplates';
import { TemplateHistoryDialog } from './TemplateHistoryDialog';
import { TemplateVersion } from '../hooks/useTemplateVersions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TemplatesTab() {
  const { user } = useAuth();
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const [search, setSearch] = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [saving, setSaving] = useState(false);

  // View dialog
  const [viewing, setViewing] = useState<Template | null>(null);

  // Delete dialog
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [deleteTypedName, setDeleteTypedName] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit confirm dialog
  const [editConfirmTemplate, setEditConfirmTemplate] = useState<Template | null>(null);

  // History dialog
  const [historyTemplate, setHistoryTemplate] = useState<Template | null>(null);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setEditing(null);
    setFormName('');
    setFormDescription('');
    setFormPrompt('');
    setDialogOpen(true);
  };

  const confirmEdit = (t: Template) => {
    setEditConfirmTemplate(t);
  };

  const proceedEdit = () => {
    if (!editConfirmTemplate) return;
    setEditing(editConfirmTemplate);
    setFormName(editConfirmTemplate.name);
    setFormDescription(editConfirmTemplate.description || '');
    setFormPrompt(editConfirmTemplate.prompt_text);
    setEditConfirmTemplate(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrompt.trim()) return;
    setSaving(true);
    let ok: boolean;
    if (editing) {
      ok = await updateTemplate(editing.id, {
        name: formName.trim(),
        description: formDescription.trim() || null,
        prompt_text: formPrompt,
      }, user?.name);
    } else {
      ok = await createTemplate(formName.trim(), formDescription.trim() || null, formPrompt, user?.name);
    }
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const openDelete = (t: Template) => {
    setDeleting(t);
    setDeleteTypedName('');
    setDeleteConfirmed(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    await deleteTemplate(deleting.id);
    setDeleteLoading(false);
    setDeleting(null);
  };

  const deleteNameMatch = deleting ? deleteTypedName === deleting.name : false;
  const canDelete = deleteNameMatch && deleteConfirmed && !deleteLoading;

  const handleRestore = async (version: TemplateVersion) => {
    await updateTemplate(version.template_id, {
      name: version.name,
      description: version.description,
      prompt_text: version.prompt_text,
    }, user?.name);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Templates de Prompt</CardTitle>
            <CardDescription>Cadastre e gerencie os prompts base da Julia</CardDescription>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo Template
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {search ? 'Nenhum template encontrado.' : 'Nenhum template cadastrado ainda.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(t => (
              <Card key={t.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" title="Visualizar" onClick={() => setViewing(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistoryTemplate(t)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => confirmEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => openDelete(t)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {t.description && <CardDescription className="line-clamp-2">{t.description}</CardDescription>}
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground font-mono line-clamp-3">{t.prompt_text}</p>
                  <div className="mt-4 space-y-0.5">
                    <p className="text-[11px] text-muted-foreground/70">
                      Criado em {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {t.created_by ? ` por ${t.created_by}` : ''}
                    </p>
                    {t.updated_at && t.updated_at !== t.created_at && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Atualizado em {format(new Date(t.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {t.updated_by ? ` por ${t.updated_by}` : ''}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={open => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            {viewing?.description && <DialogDescription>{viewing.description}</DialogDescription>}
          </DialogHeader>
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea value={viewing?.prompt_text || ''} readOnly className="min-h-[400px] font-mono text-sm bg-muted" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Atualize os dados do template.' : 'Preencha os dados do novo template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Prompt Atendimento Previdenciário" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Breve descrição do template..." rows={2} />
            </div>
            <div>
              <Label>Prompt *</Label>
              <Textarea value={formPrompt} onChange={e => setFormPrompt(e.target.value)} placeholder="Cole o prompt completo aqui..." className="min-h-[400px] font-mono text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim() || !formPrompt.trim()}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Confirm Dialog */}
      <AlertDialog open={!!editConfirmTemplate} onOpenChange={open => !open && setEditConfirmTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Edição</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja editar o template <strong>"{editConfirmTemplate?.name}"</strong>? As alterações substituirão os dados atuais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button onClick={proceedEdit}>Sim, Editar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm Dialog */}
      <AlertDialog open={!!deleting} onOpenChange={open => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Para confirmar, digite o nome do template abaixo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nome do template:</Label>
              <Input value={deleting?.name || ''} readOnly className="bg-muted font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delete-confirm-name" className="text-sm font-medium">Digite o nome para confirmar:</Label>
              <Input
                id="delete-confirm-name"
                value={deleteTypedName}
                onChange={e => setDeleteTypedName(e.target.value)}
                placeholder="Digite o nome exato..."
                className={deleteTypedName && !deleteNameMatch ? 'border-destructive' : ''}
                disabled={deleteLoading}
              />
              {deleteTypedName && !deleteNameMatch && (
                <p className="text-xs text-destructive">O nome não corresponde</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="delete-confirm-check"
                checked={deleteConfirmed}
                onCheckedChange={checked => setDeleteConfirmed(checked === true)}
                disabled={deleteLoading}
              />
              <Label htmlFor="delete-confirm-check" className="text-sm font-medium leading-none">
                Confirmo que desejo excluir este template permanentemente
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
              {deleteLoading ? 'Excluindo...' : 'Excluir Template'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <TemplateHistoryDialog
        template={historyTemplate}
        open={!!historyTemplate}
        onOpenChange={(open) => !open && setHistoryTemplate(null)}
        onRestore={handleRestore}
      />
    </Card>
  );
}
