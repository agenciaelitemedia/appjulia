import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ComercialCard, ComercialStage } from '../types';
import { ComercialLeadCard } from './ComercialLeadCard';

const ITEMS_PER_PAGE = 30;

interface Props {
  stage: ComercialStage;
  cards: ComercialCard[];
  onCardClick: (card: ComercialCard) => void;
  onMoveCard: (cardId: number, fromStageId: number, toStageId: number) => void;
}

export function ComercialPipelineColumn({ stage, cards, onCardClick, onMoveCard }: Props) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [cards.length]);

  const displayed = cards.slice(0, visibleCount);
  const hasMore = cards.length > visibleCount;
  const remaining = Math.min(ITEMS_PER_PAGE, cards.length - visibleCount);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const cardId = Number(e.dataTransfer.getData('cardId'));
    const fromStageId = Number(e.dataTransfer.getData('fromStageId'));
    if (cardId && fromStageId !== stage.id) {
      onMoveCard(cardId, fromStageId, stage.id);
    }
  };

  return (
    <div
      className={`flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg transition-all ${
        isDragOver ? 'ring-2 ring-primary/50 bg-primary/5' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="p-3 rounded-t-lg flex items-center justify-between" style={{ backgroundColor: `${stage.color}20` }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="font-medium text-sm">{stage.name}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">{cards.length}</Badge>
      </div>

      <div className="flex-1 p-2">
        <div className="space-y-2">
          {cards.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Nenhum item neste estágio</div>
          ) : (
            <>
              {displayed.map((card) => (
                <ComercialLeadCard key={card.id} card={card} onClick={() => onCardClick(card)} />
              ))}
              {hasMore && (
                <div className="pt-2 border-t border-border/50 text-center space-y-1">
                  <Button variant="ghost" size="sm" onClick={() => setVisibleCount((p) => Math.min(p + ITEMS_PER_PAGE, cards.length))} className="w-full gap-1 text-muted-foreground hover:text-foreground">
                    <ChevronDown className="h-4 w-4" /> Ver mais ({remaining})
                  </Button>
                  <p className="text-xs text-muted-foreground">Exibindo {visibleCount} de {cards.length}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
