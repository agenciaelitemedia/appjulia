import { useCallback, useEffect, useRef, useState } from 'react';

interface CRMScrollNavigationProps {
  scrollRef: React.RefObject<HTMLDivElement>;
}

export function CRMScrollNavigation({ scrollRef }: CRMScrollNavigationProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

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
    <div className="flex items-center justify-center py-3 px-4 border-t bg-background sticky bottom-0 mt-2">
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
