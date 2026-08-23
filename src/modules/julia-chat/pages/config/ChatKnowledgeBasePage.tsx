import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, BookOpen, Plus, Search, Pencil, Trash2, Eye } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useKbArticles,
  useSaveKbArticle,
  useDeleteKbArticle,
  type KbArticle,
} from '@/hooks/useChatKnowledgeBase';
import { format } from 'date-fns';

export default function ChatKnowledgeBasePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = String(user?.id ?? '');
  const [search, setSearch] = useState('');
  const { data: articles = [], isLoading } = useKbArticles(clientId, search);
  const save = useSaveKbArticle();
  const del = useDeleteKbArticle();

  const [editing, setEditing] = useState<Partial<KbArticle> | null>(null);
  const [viewing, setViewing] = useState<KbArticle | null>(null);

  const handleSave = async () => {
    if (!editing?.title || !editing.content) return;
    await save.mutateAsync({
      ...editing,
      client_id: clientId,
      title: editing.title,
      content: editing.content,
      tags: editing.tags ?? [],
      keywords: editing.keywords ?? [],
      is_published: editing.is_published ?? true,
    });
    setEditing(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Base de Conhecimento
          </h2>
          <p className="text-muted-foreground text-sm">Artigos e respostas reutilizáveis para o atendimento</p>
        </div>
        <Button onClick={() => setEditing({ title: '', content: '', tags: [], keywords: [], is_published: true })}>
          <Plus className="h-4 w-4 mr-1" /> Novo artigo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por título, conteúdo ou tags…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center text-muted-foreground py-8">Carregando…</div>
        ) : articles.length === 0 ? (
          <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">Nenhum artigo</CardContent></Card>
        ) : articles.map(a => (
          <Card key={a.id} className="hover:shadow-md transition cursor-pointer" onClick={() => setViewing(a)}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold line-clamp-2 flex-1">{a.title}</h3>
                {!a.is_published && <Badge variant="secondary" className="text-[10px]">Rascunho</Badge>}
              </div>
              {a.summary && <p className="text-xs text-muted-foreground line-clamp-2">{a.summary}</p>}
              <div className="flex flex-wrap gap-1">
                {a.tags.slice(0, 3).map(t => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                <span>{format(new Date(a.updated_at), 'dd/MM/yyyy')}</span>
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{a.view_count}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); setEditing(a); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Remover "${a.title}"?`)) del.mutate(a.id);
                  }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Editar artigo' : 'Novo artigo'}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Título</Label>
                <Input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Resumo (opcional)</Label>
                <Input value={editing.summary || ''} onChange={e => setEditing({ ...editing, summary: e.target.value })} />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea
                  rows={10}
                  value={editing.content || ''}
                  onChange={e => setEditing({ ...editing, content: e.target.value })}
                  placeholder="Texto completo do artigo / resposta…"
                />
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input
                  value={(editing.tags || []).join(', ')}
                  onChange={e => setEditing({ ...editing, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Publicado</Label>
                <Switch
                  checked={editing.is_published !== false}
                  onCheckedChange={(v) => setEditing({ ...editing, is_published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Viewer */}
      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.title}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3">
              {viewing.summary && <p className="text-sm text-muted-foreground italic">{viewing.summary}</p>}
              <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground">
                {viewing.content}
              </div>
              <div className="flex flex-wrap gap-1">
                {viewing.tags.map(t => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
