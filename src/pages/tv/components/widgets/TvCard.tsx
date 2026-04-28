import { cn } from '@/lib/utils';

/**
 * Container padrão das cenas da TV — fundo escuro, padding e borda consistente.
 */
export function TvCard({
  title,
  className,
  children,
  rightSlot,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className={cn('rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 flex flex-col', className)}>
      {(title || rightSlot) && (
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h3 className="text-xs uppercase tracking-widest font-semibold text-zinc-400">{title}</h3>
          )}
          {rightSlot}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
