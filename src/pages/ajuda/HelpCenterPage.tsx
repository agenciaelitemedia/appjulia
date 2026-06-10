import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Settings2, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useHelpStudioAccess } from '@/hooks/useHelpStudioAccess';
import {
  usePublishedHelpPosts, useHelpCategories, useMyHelpViews, type HelpPost,
} from '@/hooks/useHelpCenter';
import { HelpHero } from './components/HelpHero';
import { HelpRow } from './components/HelpRow';
import { HelpPostCard } from './components/HelpPostCard';

export default function HelpCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canAccessStudio: canManage } = useHelpStudioAccess();
  const [search, setSearch] = useState('');

  const { data: posts = [], isLoading } = usePublishedHelpPosts();
  const { data: categories = [] } = useHelpCategories();
  const { data: myViews = [] } = useMyHelpViews(user ? String(user.id) : undefined);

  const featured = useMemo(
    () => posts.filter(p => p.is_featured).sort((a, b) => a.featured_order - b.featured_order).slice(0, 6),
    [posts]
  );

  const recent = useMemo(() => [...posts].slice(0, 12), [posts]);

  const mostViewed = useMemo(
    () => [...posts].sort((a, b) => b.view_count - a.view_count).filter(p => p.view_count > 0).slice(0, 12),
    [posts]
  );

  const continueReading = useMemo(() => {
    const byId = new Map(posts.map(p => [p.id, p]));
    return myViews.map(v => byId.get(v.post_id)).filter(Boolean) as HelpPost[];
  }, [posts, myViews]);

  const searchResults = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return null;
    return posts.filter(p =>
      p.title.toLowerCase().includes(s) ||
      (p.summary || '').toLowerCase().includes(s) ||
      (p.tags || []).some(t => t.toLowerCase().includes(s))
    );
  }, [posts, search]);

  return (
    <div className="bg-background -m-4 lg:-m-6 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <BookOpen className="h-6 w-6 text-red-500" />
            <h1 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">Central de Ajuda</h1>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 bg-card border-border text-foreground placeholder:text-muted-foreground rounded-full"
              placeholder="Buscar conteúdo, tags…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {canManage && (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate('/ajuda/studio')}
            >
              <Settings2 className="h-4 w-4 mr-2" /> Studio
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="py-24 text-center text-muted-foreground">Carregando conteúdos…</div>
        ) : searchResults ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">
              {searchResults.length} resultado{searchResults.length === 1 ? '' : 's'} para "{search}"
            </h2>
            {searchResults.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center">Nenhum conteúdo encontrado</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {searchResults.map(p => <HelpPostCard key={p.id} post={p} />)}
              </div>
            )}
          </div>
        ) : posts.length === 0 ? (
          <div className="py-24 text-center space-y-3">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mx-auto" />
            <p className="text-muted-foreground">Nenhum conteúdo publicado ainda</p>
            {canManage && (
              <Button className="rounded-full" onClick={() => navigate('/ajuda/studio/post/novo')}>
                Criar primeiro post
              </Button>
            )}
          </div>
        ) : (
          <>
            <HelpHero posts={featured.length > 0 ? featured : recent.slice(0, 3)} />

            <div className="space-y-8">
              {continueReading.length > 0 && (
                <HelpRow title="Continue lendo" posts={continueReading} accentColor="#22c55e" />
              )}
              <HelpRow title="Adicionados recentemente" posts={recent} accentColor="#ef4444" />
              {mostViewed.length > 0 && (
                <HelpRow title="Mais vistos" posts={mostViewed} accentColor="#f59e0b" />
              )}
              {categories.map(cat => (
                <HelpRow
                  key={cat.id}
                  title={cat.name}
                  posts={posts.filter(p => p.category_id === cat.id)}
                  accentColor={cat.color}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}