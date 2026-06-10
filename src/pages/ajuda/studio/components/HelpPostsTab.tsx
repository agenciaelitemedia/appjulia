import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Pencil, Trash2, Eye, ImageIcon, Star } from 'lucide-react';
import { format } from 'date-fns';
import {
  useHelpPostsAdmin, useHelpCategories, useDeleteHelpPost, useSaveHelpPost, type HelpPost,
} from '@/hooks/useHelpCenter';

export function HelpPostsTab() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [status, setStatus] = useState('all');
  const { data: posts = [], isLoading } = useHelpPostsAdmin({ search, categoryId, status });
  const { data: categories = [] } = useHelpCategories(true);
  const del = useDeleteHelpPost();
  const save = useSaveHelpPost();
  const [deleting, setDeleting] = useState<HelpPost | null>(null);

  const catName = (id: string | null) => categories.find(c => c.id === id)?.name || 'Sem categoria';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar post…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="published">Publicado</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => navigate('/ajuda/studio/post/novo')}>
          <Plus className="h-4 w-4 mr-1" /> Novo post
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando…</p>
      ) : posts.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum post encontrado</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {posts.map(post => (
            <Card key={post.id} className="hover:shadow-sm transition">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-14 w-24 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {post.cover_image_url ? (
                    <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{post.title}</span>
                    {post.is_featured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="text-[10px]">
                      {post.status === 'published' ? 'Publicado' : 'Rascunho'}
                    </Badge>
                    <span>{catName(post.category_id)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.view_count}</span>
                    <span>·</span>
                    <span>{format(new Date(post.updated_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => save.mutate({ id: post.id, title: post.title, is_featured: !post.is_featured })}
                >
                  <Star className={post.is_featured ? 'h-4 w-4 text-amber-500 fill-amber-500' : 'h-4 w-4'} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate(`/ajuda/studio/post/${post.id}`)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setDeleting(post)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleting} onOpenChange={v => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir post "{deleting?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>O post e o histórico de visualizações serão removidos. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}