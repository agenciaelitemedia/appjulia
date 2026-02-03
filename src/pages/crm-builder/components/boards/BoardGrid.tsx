import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BoardCard } from './BoardCard';
import type { CRMBoard } from '../../types';

interface BoardGridProps {
  boards: CRMBoard[];
  isLoading: boolean;
  onBoardClick: (board: CRMBoard) => void;
  onBoardEdit: (board: CRMBoard) => void;
  onBoardArchive: (board: CRMBoard) => void;
  onCreateClick: () => void;
}

export function BoardGrid({
  boards,
  isLoading,
  onBoardClick,
  onBoardEdit,
  onBoardArchive,
  onCreateClick,
}: BoardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {boards.map((board) => (
        <BoardCard
          key={board.id}
          board={board}
          onClick={() => onBoardClick(board)}
          onEdit={() => onBoardEdit(board)}
          onArchive={() => onBoardArchive(board)}
        />
      ))}
      
      {/* Create new board card */}
      <Button
        variant="outline"
        className="h-40 border-2 border-dashed hover:border-primary hover:bg-primary/5 transition-all"
        onClick={onCreateClick}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Plus className="h-8 w-8" />
          <span className="font-medium">Novo Board</span>
        </div>
      </Button>
    </div>
  );
}
