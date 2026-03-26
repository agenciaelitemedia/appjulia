import { useState } from 'react';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useTemplates, Template } from '../hooks/useTemplates';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function TemplatesTab() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useTemplates();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrompt, setFormPrompt] = useState('');
  const [saving, setSaving] = useState(false);

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

  const openEdit = (t: Template) => {
    setEditing(t);
    setFormName(t.name);
    setFormDescription(t.description || '');
    setFormPrompt(t.prompt_text);
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
      });
    } else {
      ok = await createTemplate(formName.trim(), formDescription.trim() || null, formPrompt);
    }
    setSaving(false);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    await deleteTemplate(id);
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
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
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
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {t.description && (
                    <CardDescription className="line-clamp-2">{t.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground font-mono line-clamp-3">{t.prompt_text}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Criado em {format(new Date(t.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

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
              <Textarea
                value={formPrompt}
                onChange={e => setFormPrompt(e.target.value)}
                placeholder="Cole o prompt completo aqui..."
                className="min-h-[400px] font-mono text-sm"
              />
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
    </Card>
  );
}
