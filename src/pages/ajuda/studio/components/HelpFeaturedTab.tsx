import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Star, ImageIcon, X } from 'lucide-react';
import { useHelpPostsAdmin, useSaveHelpPost } from '@/hooks/useHelpCenter';

export function HelpFeaturedTab() {
  const { data: posts = [], isLoading } = useHelpPostsAdmin({});
  const save = useSaveHelpPost();

  const featured = posts
    .filter(p => p.is_featured)
    .sort((a, b) => a.featured_order - b.featured_order);

  const move = (idx: number, dir: -1 | 1) => {
    const a = featured[idx];
    const b = featured[idx + dir];
    if (!a || !b) return;
    save.mutate({ id: a.id, title: a.title, featured_order: idx + dir });
    save.mutate({ id: b.id, title: b.title, featured_order: idx });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Posts marcados como destaque aparecem no banner principal (hero) da Central de Ajuda, na ordem abaixo.
        Marque/desmarque destaques na aba Posts (ícone <Star className="h-3.5 w-3.5 inline text-amber-500 fill-amber-500" />).
      </p>
      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando…</p>
      ) : featured.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum post em destaque</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {featured.map((post, idx) => (
            <Card key={post.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <Badge variant="outline" className="rounded-full h-7 w-7 flex items-center justify-center p-0">{idx + 1}</Badge>
                <div className="h-12 w-20 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                  {post.cover_image_url ? (
                    <img src={post.cover_image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">{post.title}</span>
                  {post.status !== 'published' && <Badge variant="secondary" className="text-[10px]">Rascunho (não aparece)</Badge>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={idx === 0} onClick={() => move(idx, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={idx === featured.length - 1} onClick={() => move(idx, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  title="Remover dos destaques"
                  onClick={() => save.mutate({ id: post.id, title: post.title, is_featured: false })}
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}