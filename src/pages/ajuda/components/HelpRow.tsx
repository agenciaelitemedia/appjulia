import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HelpPostCard } from './HelpPostCard';
import type { HelpPost } from '@/hooks/useHelpCenter';

interface HelpRowProps {
  title: string;
  posts: HelpPost[];
  accentColor?: string | null;
}

export function HelpRow({ title, posts, accentColor }: HelpRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  if (posts.length === 0) return null;

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 560, behavior: 'smooth' });
  };

  return (
    <section className="space-y-2 group/row">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          {accentColor && <span className="h-4 w-1 rounded-full" style={{ backgroundColor: accentColor }} />}
          {title}
        </h2>
        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => scroll(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => scroll(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1 snap-x scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map(p => <HelpPostCard key={p.id} post={p} />)}
      </div>
    </section>
  );
}