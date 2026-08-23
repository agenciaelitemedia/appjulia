import React from 'react';
import { Link2, X, Globe } from 'lucide-react';
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

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Skeleton placeholder while link metadata is loading. */
function LinkPreviewSkeleton({ variant }: { variant: 'bubble' | 'composer' }) {
  return (
    <div
      className={cn(
        'flex gap-3 overflow-hidden border-l-4 border-primary/40 bg-muted/40 rounded',
        variant === 'composer' ? 'p-2' : 'p-2 mt-1.5'
      )}
    >
      <Skeleton className="h-16 w-16 flex-shrink-0 rounded" />
      <div className="flex-1 min-w-0 py-0.5 space-y-2">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-2.5 w-1/3" />
      </div>
    </div>
  );
}

/** Minimal fallback when metadata fetch fails or returns empty. */
function LinkPreviewFallback({ url, variant }: { url: string; variant: 'bubble' | 'composer' }) {
  const domain = getDomain(url);
  const inner = (
    <div
      className={cn(
        'flex gap-3 overflow-hidden border-l-4 border-muted bg-muted/30 rounded',
        variant === 'composer' ? 'p-2' : 'p-2 mt-1.5'
      )}
    >
      <div className="h-16 w-16 flex-shrink-0 rounded bg-muted flex items-center justify-center text-muted-foreground">
        <Globe className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-center">
        <div className="text-xs text-muted-foreground line-clamp-2">
          Prévia indisponível
        </div>
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-1 truncate">
          {domain}
        </div>
      </div>
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

/** WhatsApp-style link preview card. */
export function LinkPreviewCard({ url, preset, variant = 'bubble', onDismiss, className }: LinkPreviewCardProps) {
  const { data, isLoading, isError } = useLinkPreview(url, !preset);
  const preview = preset ?? data;

  const hasContent = !!(preview && (preview.title || preview.description || preview.image));

  // Loading state — skeleton for both bubble and composer
  if (!preview && isLoading) {
    return <LinkPreviewSkeleton variant={variant} />;
  }

  // Error / empty fallback — show minimal card instead of disappearing
  if (isError || (!hasContent && !isLoading)) {
    return <LinkPreviewFallback url={url} variant={variant} />;
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
          {preview!.site_name || preview!.domain || getDomain(url)}
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