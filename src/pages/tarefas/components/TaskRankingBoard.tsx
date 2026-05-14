import { cn } from '@/lib/utils';
import { Trophy, Medal } from 'lucide-react';
import type { RankingEntry } from '@/hooks/useTaskPoints';

interface TaskRankingBoardProps {
  ranking: RankingEntry[];
  myUserId?: string;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const BAR_COLORS = ['bg-amber-400', 'bg-slate-400', 'bg-amber-600', 'bg-primary'];

export function TaskRankingBoard({ ranking, myUserId }: TaskRankingBoardProps) {
  if (ranking.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
        <Trophy className="h-8 w-8 opacity-30" />
        <p className="text-sm">Nenhuma pontuação ainda neste período.</p>
      </div>
    );
  }

  const max = Math.max(...ranking.map((r) => r.points), 1);

  return (
    <div className="space-y-2">
      {ranking.map((entry, i) => {
        const isMe = String(myUserId) === entry.userId;
        const pct = Math.max((entry.points / max) * 100, 3);
        const barColor = BAR_COLORS[Math.min(i, BAR_COLORS.length - 1)];

        return (
          <div key={entry.userId}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2', isMe && 'bg-primary/5 border border-primary/20')}>
            {/* Rank / Medal */}
            <span className="w-7 text-center text-base flex-shrink-0">
              {i < 3 ? MEDALS[i] : <span className="text-xs text-muted-foreground font-medium">{i + 1}º</span>}
            </span>

            {/* Name + bar */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-sm font-medium truncate', isMe && 'text-primary')}>
                  {entry.userName}{isMe && ' (você)'}
                </span>
                <span className="text-sm font-bold text-amber-600 flex-shrink-0">{entry.points} pts</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
