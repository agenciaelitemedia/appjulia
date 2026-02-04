import { useCallback, useEffect, useRef, useState } from 'react';
import { useSidebarState } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';

interface CRMScrollNavigationProps {
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function CRMScrollNavigation({ scrollRef }: CRMScrollNavigationProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const { isCollapsed } = useSidebarState();

  const updateScrollState = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScroll = scrollWidth - clientWidth;
    
    if (maxScroll <= 0) {
      setScrollProgress(0);
    } else {
      setScrollProgress((scrollLeft / maxScroll) * 100);
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

  const handleDrag = useCallback((clientX: number) => {
    const track = trackRef.current;
    const container = scrollRef.current;
    if (!track || !container) return;

    const rect = track.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.scrollLeft = percent * maxScroll;
  }, [scrollRef]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    handleDrag(e.clientX);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    handleDrag(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDrag(e.clientX);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleDrag(e.touches[0].clientX);
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, handleDrag]);

  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 flex items-center justify-center py-3 px-4 border-t bg-background z-50 transition-all duration-300",
      isCollapsed ? "lg:left-16" : "lg:left-64"
    )}>
      <div 
        ref={trackRef}
        className="flex-1 max-w-md h-1 bg-border rounded-full cursor-pointer relative"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div
          className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary border-2 border-background rounded-full shadow-md transition-transform ${
            isDragging ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-110'
          }`}
          style={{ left: `calc(${scrollProgress}% - 8px)` }}
        />
      </div>
    </div>
  );
}
