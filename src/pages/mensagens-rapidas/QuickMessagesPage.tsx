import { useState } from 'react';
import { Plus, Pencil, Trash2, Zap, Search, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuickMessages, type QuickMessage } from '@/hooks/useQuickMessages';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const USE_LOCATION_OPTIONS = [
  { value: 'chat_popup', label: 'Chat Rápido (Popup)' },
  { value: 'chat_full', label: 'Chat Completo' },
  { value: 'followup', label: 'Follow-up' },
];

export default function QuickMessagesPage() {
  const { allMessages, isLoadingAll, create, update, remove, isCreating, isUpdating, isDeleting } = useQuickMessages();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<QuickMessage | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formText, setFormText] = useState('');
  const [formShortcut, setFormShortcut] = useState('');
  const [formCategory, setFormCategory] = useState('geral');
  const [formLocations, setFormLocations] = useState<string[]>(['chat_popup']);
  const [formActive, setFormActive] = useState(true);

  const resetForm = () => {
    setFormTitle('');
    setFormText('');
    setFormShortcut('');
    setFormCategory('geral');
    setFormLocations(['chat_popup']);
    setFormActive(true);
    setEditingMessage(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (msg: QuickMessage) => {
    setEditingMessage(msg);
    setFormTitle(msg.title);
    setFormText(msg.message_text);
    setFormShortcut(msg.shortcut || '');
    setFormCategory(msg.category || 'geral');
    setFormLocations(msg.use_locations || ['chat_popup']);
    setFormActive(msg.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formText.trim()) {
      toast({ title: 'Preencha título e texto da mensagem', variant: 'destructive' });
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        message_text: formText.trim(),
        shortcut: formShortcut.trim() || null,
        category: formCategory,
        use_locations: formLocations,
        is_active: formActive,
      };

      if (editingMessage) {
        await update({ id: editingMessage.id, ...payload });
        toast({ title: 'Mensagem atualizada' });
      } else {
        await create(payload);
        toast({ title: 'Mensagem criada' });
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove(deleteId);
      toast({ title: 'Mensagem excluída' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteId(null);
    }
  };

  const toggleLocation = (value: string) => {
    setFormLocations(prev =>
      prev.includes(value)
        ? prev.filter(l => l !== value)
        : [...prev, value]
    );
  };

  const filtered = allMessages.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    m.message_text.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Mensagens Rápidas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie mensagens pré-definidas para uso rápido nos chats
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Mensagem
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar mensagens..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoadingAll ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              {search ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem rápida cadastrada'}
            </p>
            {!search && (
              <Button variant="outline" className="mt-4" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira mensagem
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(msg => (
            <Card key={msg.id} className={!msg.is_active ? 'opacity-50' : ''}>
              <CardContent className="flex items-start gap-4 py-4">
                <GripVertical className="h-5 w-5 text-muted-foreground/40 mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{msg.title}</span>
                    {msg.shortcut && (
                      <Badge variant="secondary" className="text-xs">/{msg.shortcut}</Badge>
                    )}
                    {!msg.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{msg.message_text}</p>
                  <div className="flex gap-1 mt-2">
                    {(msg.use_locations || []).map(loc => {
                      const opt = USE_LOCATION_OPTIONS.find(o => o.value === loc);
                      return (
                        <Badge key={loc} variant="outline" className="text-[10px]">
                          {opt?.label || loc}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(msg)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(msg.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingMessage ? 'Editar Mensagem' : 'Nova Mensagem Rápida'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Ex: Saudação inicial" />
            </div>
            <div>
              <Label>Texto da mensagem *</Label>
              <Textarea value={formText} onChange={e => setFormText(e.target.value)} placeholder="Texto que será inserido no chat..." rows={4} />
            </div>
            <div>
              <Label>Atalho (opcional)</Label>
              <Input value={formShortcut} onChange={e => setFormShortcut(e.target.value)} placeholder="Ex: saudacao" />
              <p className="text-xs text-muted-foreground mt-1">Use /{formShortcut || 'atalho'} para buscar rapidamente</p>
            </div>
            <div>
              <Label>Onde usar</Label>
              <div className="space-y-2 mt-2">
                {USE_LOCATION_OPTIONS.map(opt => (
                  <div key={opt.value} className="flex items-center gap-2">
                    <Checkbox
                      id={opt.value}
                      checked={formLocations.includes(opt.value)}
                      onCheckedChange={() => toggleLocation(opt.value)}
                    />
                    <label htmlFor={opt.value} className="text-sm cursor-pointer">{opt.label}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingMessage ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
