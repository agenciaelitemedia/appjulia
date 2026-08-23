import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Pencil, Check, X, Plus, Tag } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';
import { cn } from '@/lib/utils';
import type { ChatTag } from '@/types/conversation';

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981',
  '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
  '#64748b', '#78716c', '#1e293b',
];

interface TagsManagerDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COLOR_PRESETS.map(c => (
        <button
          key={c}
          type="button"
          className={cn(
            'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
            value === c ? 'border-foreground scale-110' : 'border-transparent'
          )}
          style={{ backgroundColor: c }}
          onClick={() => onChange(c)}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-5 w-5 rounded-full cursor-pointer border-0 bg-transparent p-0"
        title="Cor personalizada"
      />
    </div>
  );
}

function TagRow({ tag, onSaved, onDeleted }: { tag: ChatTag; onSaved: () => void; onDeleted: () => void }) {
  const { updateTag, deleteTag } = useWhatsAppData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await updateTag(tag.id, { name: name.trim(), color });
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir a tag "${tag.name}"? Será removida de todas as conversas.`)) return;
    await deleteTag(tag.id);
    onDeleted();
  };

  if (editing) {
    return (
      <div className="space-y-2 p-2 rounded-lg border bg-muted/30">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          className="h-7 text-xs"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex gap-1">
          <Button size="sm" className="h-6 text-xs px-2" onClick={handleSave} disabled={saving}>
            <Check className="h-3 w-3 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setEditing(false); setName(tag.name); setColor(tag.color); }}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 group">
      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
      <span className="flex-1 text-sm truncate">{tag.name}</span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(true)}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={handleDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function TagsManagerContent() {
  const { tags, createTag } = useWhatsAppData();
  const { user, isAdmin } = useAuth();
  const { settings, update } = useChatClientSettings();
  // Donos do escritório (admin, colaborador, user) sempre podem gerenciar
  // etiquetas por esta tela. O switch abaixo controla a criação direta pelo
  // chat para os demais perfis.
  const isOwner = isAdmin || ['colaborador', 'user'].includes(user?.role ?? '');
  const canManage = isOwner;
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await createTag(newName.trim(), newColor);
    setCreating(false);
    setNewName('');
    setNewColor('#3b82f6');
    setShowNew(false);
  };

  return (
    <div className="space-y-3">
        {isOwner && (
          <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="allow-anyone-tags" className="text-sm font-medium">
                Permitir criação de etiquetas por qualquer usuário
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando desativado, apenas o dono do escritório pode criar etiquetas — e somente por esta tela.
                A criação direta pelo chat fica desabilitada para os demais usuários.
              </p>
            </div>
            <Switch
              id="allow-anyone-tags"
              checked={settings.allow_anyone_create_tags}
              onCheckedChange={(v) => update.mutate({ allow_anyone_create_tags: v })}
            />
          </div>
        )}
        <div className="space-y-1 max-h-[50vh] overflow-y-auto pr-1">
          {tags.length === 0 && !showNew && (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma tag criada</p>
          )}
          {tags.map(tag => (
            canManage ? (
              <TagRow key={tag.id} tag={tag} onSaved={() => {}} onDeleted={() => {}} />
            ) : (
              <div key={tag.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg">
                <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 text-sm truncate">{tag.name}</span>
              </div>
            )
          ))}
        </div>

        {!canManage ? null : showNew ? (
          <div className="space-y-2 p-2 rounded-lg border bg-muted/30">
            <Input
              placeholder="Nome da tag"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="h-7 text-xs"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowNew(false); }}
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <div className="flex gap-1">
              <Button size="sm" className="h-6 text-xs px-2" onClick={handleCreate} disabled={creating || !newName.trim()}>
                <Check className="h-3 w-3 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setShowNew(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full h-7 text-xs gap-1.5" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Nova tag
          </Button>
        )}
    </div>
  );
}

export function TagsManagerDialog({ open, onOpenChange }: TagsManagerDialogProps) {
  const { user } = useAuth();
  const canManage = !!user && !['time', 'comercial', 'advogado'].includes(user.role);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Tag className="h-4 w-4" /> {canManage ? 'Gerenciar Tags' : 'Tags disponíveis'}
          </DialogTitle>
        </DialogHeader>
        <TagsManagerContent />
      </DialogContent>
    </Dialog>
  );
}
