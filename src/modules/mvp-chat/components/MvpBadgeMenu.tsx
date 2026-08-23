import type { ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import {
  cn, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '../extend/ui';

/**
 * Badge de largura fixa (mesmo visual do card) com setinha e menu de ações.
 * O clique é isolado para não abrir a conversa da linha.
 */
export function MvpBadgeMenu({
  icon: Icon, label, width, tone, tooltip, children, align = 'start',
}: {
  icon?: LucideIcon;
  label: string;
  width: string;
  tone: string;
  tooltip: string;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <DropdownMenu>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <span
                role="button"
                tabIndex={0}
                onClick={stop}
                onPointerDown={stop}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); }}
                className={cn(
                  'inline-flex h-5 shrink-0 cursor-pointer select-none items-center justify-center gap-1 overflow-hidden rounded-full border px-1.5 text-[10px] font-medium outline-none transition-opacity hover:opacity-80 focus-visible:ring-1 focus-visible:ring-ring',
                  width,
                  tone,
                )}
              >
                {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
                <span className="truncate">{label}</span>
                <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-70" aria-hidden />
              </span>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DropdownMenuContent
        align={align}
        className="w-56"
        onClick={stop}
        onPointerDown={stop}
      >
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
