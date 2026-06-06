import React from 'react';
import { Link2, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useLinkPreview, type LinkPreviewData } from '@/hooks/useLinkPreview';

interface LinkPreviewCardProps {
  url: string;
  preset?: LinkPreviewData | null;
  variant?: 'bubble' | 'composer';
  onDismiss?: () => void;
  className?: string;
}

/** WhatsApp-style link preview card. */
export function LinkPreviewCard({ url, preset, variant = 'bubble', onDismiss, className }: LinkPreviewCardProps) {
  const { data, isLoading } = useLinkPreview(url, !preset);
  const preview = preset ?? data;

  const hasContent = !!(preview && (preview.title || preview.description || preview.image));

  if (!preview && isLoading && variant === 'composer') {
    return (
      <div className={cn('flex gap-3 p-2 rounded-md border border-border bg-muted/40', className)}>
        <Skeleton className="h-14 w-14 rounded" />
        <div className="flex-1 space-y-2 py-1">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    );
  }

  if (!hasContent) return null;

  const inner = (
    <div
      className={cn(
        'flex gap-3 overflow-hidden border-l-4 border-primary bg-background/60 rounded',
        variant === 'composer' ? 'p-2' : 'p-2 mt-1.5',
        className,
      )}
    >
      {preview!.image ? (
        <img
          src={preview!.image}
          alt=""
          loading="lazy"
          className="h-16 w-16 flex-shrink-0 rounded object-cover bg-muted"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="h-16 w-16 flex-shrink-0 rounded bg-muted flex items-center justify-center text-muted-foreground">
          <Link2 className="h-5 w-5" />
        </div>
      )}
      <div className="flex-1 min-w-0 py-0.5">
        {preview!.title && (
          <div className="text-sm font-semibold line-clamp-2 leading-snug text-foreground">
            {preview!.title}
          </div>
        )}
        {preview!.description && (
          <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {preview!.description}
          </div>
        )}
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1 truncate">
          {preview!.site_name || preview!.domain}
        </div>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDismiss(); }}
          className="self-start text-muted-foreground hover:text-foreground"
          aria-label="Remover prévia do link"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  if (variant === 'bubble') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block no-underline hover:opacity-95 transition-opacity"
      >
        {inner}
      </a>
    );
  }
  return inner;
}