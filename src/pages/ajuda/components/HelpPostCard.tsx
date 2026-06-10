import { useNavigate } from 'react-router-dom';
import { Eye, FileText } from 'lucide-react';
import type { HelpPost } from '@/hooks/useHelpCenter';

export function HelpPostCard({ post }: { post: HelpPost }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/ajuda/post/${post.slug}`)}
      className="group relative w-56 sm:w-64 shrink-0 text-left snap-start"
    >
      <div className="aspect-video rounded-lg overflow-hidden bg-muted ring-1 ring-border transition-all duration-300 group-hover:ring-2 group-hover:ring-primary/70 group-hover:scale-[1.04] group-hover:shadow-2xl group-hover:shadow-black/30">
        {post.cover_image_url ? (
          <img
            src={post.cover_image_url}
            alt={post.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900">
            <FileText className="h-8 w-8 text-slate-400" />
          </div>
        )}
        <div className="absolute inset-0 rounded-lg bg-gradient-to-t from-black/95 via-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-sm font-semibold line-clamp-2 [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">{post.title}</p>
          <p className="text-white/85 text-[11px] mt-0.5 flex items-center gap-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
            <Eye className="h-3 w-3" /> {post.view_count} visualizações
          </p>
        </div>
      </div>
    </button>
  );
}