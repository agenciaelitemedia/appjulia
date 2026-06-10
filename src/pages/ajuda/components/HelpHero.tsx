import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Play, Info } from 'lucide-react';
import type { HelpPost } from '@/hooks/useHelpCenter';

export function HelpHero({ posts }: { posts: HelpPost[] }) {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (posts.length <= 1) return;
    const t = setInterval(() => setIndex(i => (i + 1) % posts.length), 7000);
    return () => clearInterval(t);
  }, [posts.length]);

  if (posts.length === 0) return null;
  const post = posts[Math.min(index, posts.length - 1)];

  return (
    <div className="relative h-[340px] sm:h-[420px] rounded-2xl overflow-hidden ring-1 ring-border shadow-lg">
      {post.cover_image_url ? (
        <img
          key={post.id}
          src={post.cover_image_url}
          alt={post.title}
          className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-800 to-slate-950" />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />

      <div className="relative h-full flex flex-col justify-end p-6 sm:p-10 max-w-2xl">
        <span className="text-[11px] font-bold tracking-[0.2em] text-red-400 uppercase mb-2 drop-shadow">Em destaque</span>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-white drop-shadow-lg leading-tight">{post.title}</h1>
        {post.summary && (
          <p className="text-white/85 text-sm sm:text-base mt-2 line-clamp-2 drop-shadow">{post.summary}</p>
        )}
        <div className="flex items-center gap-3 mt-5">
          <Button
            size="lg"
            className="bg-white text-black hover:bg-white/90 font-semibold rounded-full"
            onClick={() => navigate(`/ajuda/post/${post.slug}`)}
          >
            <Play className="h-4 w-4 mr-2 fill-black" /> Ler agora
          </Button>
          {post.summary && (
            <Button
              size="lg"
              variant="secondary"
              className="bg-white/20 text-white hover:bg-white/30 backdrop-blur rounded-full"
              onClick={() => navigate(`/ajuda/post/${post.slug}`)}
            >
              <Info className="h-4 w-4 mr-2" /> Mais informações
            </Button>
          )}
        </div>
        {posts.length > 1 && (
          <div className="flex gap-1.5 mt-5">
            {posts.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-3 bg-white/40 hover:bg-white/60'}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}