import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
  textClassName?: string;
}

export function ExpandableText({ 
  text, 
  maxLines = 2, 
  className,
  textClassName 
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsExpansion, setNeedsExpansion] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (textRef.current) {
      const lineHeight = parseInt(getComputedStyle(textRef.current).lineHeight) || 20;
      const maxHeight = lineHeight * maxLines;
      setNeedsExpansion(textRef.current.scrollHeight > maxHeight + 4);
    }
  }, [text, maxLines]);

  if (!text) return null;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        ref={textRef}
        className={cn(
          "text-xs text-muted-foreground transition-all",
          !expanded && `line-clamp-${maxLines}`,
          textClassName
        )}
        style={!expanded ? { 
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : undefined}
        title={text}
      >
        {text}
      </div>
      {needsExpansion && (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-primary"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              Ver menos <ChevronUp className="h-3 w-3 ml-1" />
            </>
          ) : (
            <>
              Ver mais <ChevronDown className="h-3 w-3 ml-1" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
