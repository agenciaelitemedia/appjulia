import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CRMScrollNavigationProps {
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function CRMScrollNavigation({ scrollRef }: CRMScrollNavigationProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;
    
    if (maxScroll <= 0) {
      setScrollProgress(0);
      setCanScrollLeft(false);
      setCanScrollRight(false);
    } else {
      setScrollProgress((scrollLeft / maxScroll) * 100);
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < maxScroll - 1);
    }
  }, [scrollRef]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    updateScrollState();
    container.addEventListener('scroll', updateScrollState);
    
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [scrollRef, updateScrollState]);

  const scrollToStart = () => {
    scrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  };

  const scrollToEnd = () => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTo({ left: container.scrollWidth, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex items-center justify-between py-2 px-1 border-t bg-background sticky bottom-0 mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={scrollToStart}
        disabled={!canScrollLeft}
        className="gap-1"
      >
        <ChevronLeft className="h-4 w-4" />
        Início
      </Button>

      <div className="flex-1 mx-4 max-w-md">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-150"
            style={{ 
              width: '20%', 
              marginLeft: `${Math.min(scrollProgress, 80)}%` 
            }}
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={scrollToEnd}
        disabled={!canScrollRight}
        className="gap-1"
      >
        Fim
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
