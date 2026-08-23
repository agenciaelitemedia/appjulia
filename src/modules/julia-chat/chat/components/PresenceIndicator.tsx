import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PresenceUser } from '@/hooks/useConversationPresence';

interface Props {
  users: PresenceUser[];
  meId?: string | null;
  max?: number;
  className?: string;
}

export function PresenceIndicator({ users, meId, max = 3, className }: Props) {
  const others = users.filter((u) => u.user_identifier !== meId);
  if (others.length === 0) return null;

  const visible = others.slice(0, max);
  const extra = others.length - visible.length;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1', className)}>
            <Eye className="h-3 w-3 text-muted-foreground" />
            <div className="flex -space-x-2">
              {visible.map((u) => {
                const initials = (u.user_name || '?')
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase();
                return (
                  <Avatar key={u.user_identifier} className="h-5 w-5 border-2 border-background">
                    {u.user_avatar && <AvatarImage src={u.user_avatar} alt={u.user_name || ''} />}
                    <AvatarFallback className="text-[9px] bg-emerald-500/15 text-emerald-700">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                );
              })}
              {extra > 0 && (
                <div className="h-5 w-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[9px] font-medium">
                  +{extra}
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <div className="font-medium mb-1">Vendo agora</div>
          {others.map((u) => (
            <div key={u.user_identifier}>{u.user_name || u.user_identifier}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
