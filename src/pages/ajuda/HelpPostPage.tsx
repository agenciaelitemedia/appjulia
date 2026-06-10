import { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Eye, Calendar, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import {
  useHelpPostBySlug, usePublishedHelpPosts, useHelpCategories, useRegisterHelpPostView,
} from '@/hooks/useHelpCenter';
import { HelpRow } from './components/HelpRow';

function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ['iframe', 'video', 'source'],
    ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'src', 'controls', 'start', 'width', 'height'],
  });
}

export default function HelpPostPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: post, isLoading } = useHelpPostBySlug(slug);
  const { data: allPosts = [] } = usePublishedHelpPosts();
  const { data: categories = [] } = useHelpCategories();
  const registerView = useRegisterHelpPostView();
  const viewedRef = useRef<string | null>(null);

  useEffect(() => {
    if (post && user && viewedRef.current !== post.id) {
      viewedRef.current = post.id;
      registerView.mutate({ postId: post.id, userId: String(user.id) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, user?.id]);

  const category = categories.find(c => c.id === post?.category_id);

  const related = useMemo(() => {
    if (!post) return [];
    return allPosts.filter(p => p.id !== post.id && p.category_id === post.category_id).slice(0, 10);
  }, [allPosts, post]);

  const cleanHtml = useMemo(() => sanitize(post?.content_html || ''), [post?.content_html]);

  if (isLoading) {
    return <div className="bg-background -m-4 lg:-m-6 min-h-[calc(100vh-4rem)] p-12 text-center text-muted-foreground">Carregando…</div>;
  }

  if (!post) {
    return (
      <div className="bg-background -m-4 lg:-m-6 min-h-[calc(100vh-4rem)] p-12 text-center space-y-4">
        <p className="text-muted-foreground">Conteúdo não encontrado</p>
        <Button className="rounded-full" onClick={() => navigate('/ajuda')}>Voltar à Central de Ajuda</Button>
      </div>
    );
  }

  return (
    <div className="bg-background -m-4 lg:-m-6 min-h-[calc(100vh-4rem)]">
      {/* Banner */}
      <div className="relative h-[260px] sm:h-[340px] overflow-hidden">
        {post.cover_image_url ? (
          <img src={post.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-black/40 to-black/10" />
        <div className="absolute top-4 left-4">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full bg-black/50 text-white hover:bg-black/70 backdrop-blur"
            onClick={() => navigate('/ajuda')}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Central de Ajuda
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 max-w-3xl mx-auto px-4 sm:px-0 pb-8">
          {category && (
            <Badge className="mb-2 border-0" style={{ backgroundColor: category.color || '#6366f1', color: '#fff' }}>
              {category.name}
            </Badge>
          )}
          <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight drop-shadow-lg">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-white/80 drop-shadow">
            {post.author_name && <span className="flex items-center gap-1"><UserIcon className="h-3.5 w-3.5" />{post.author_name}</span>}
            {post.published_at && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(new Date(post.published_at), 'dd/MM/yyyy')}</span>}
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{post.view_count} visualizações</span>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-3xl mx-auto px-4 sm:px-0 py-8">
        {post.summary && (
          <p className="text-muted-foreground text-lg italic border-l-4 border-red-600 pl-4 mb-8">{post.summary}</p>
        )}
        <article
          className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-primary prose-img:rounded-xl prose-video:rounded-xl [&_iframe]:w-full [&_iframe]:aspect-video [&_iframe]:rounded-xl [&_video]:w-full [&_video]:rounded-xl"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-10">
            {post.tags.map(t => (
              <Badge key={t} variant="outline" className="text-muted-foreground">{t}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Relacionados */}
      {related.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-12">
          <HelpRow title="Conteúdos relacionados" posts={related} accentColor={category?.color} />
        </div>
      )}
    </div>
  );
}