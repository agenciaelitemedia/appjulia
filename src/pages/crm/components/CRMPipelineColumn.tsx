import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
 import { CRMCard, CRMStage, CRMFollowupInfo } from '../types';
import { CRMLeadCard } from './CRMLeadCard';

const ITEMS_PER_PAGE = 30;

interface CRMPipelineColumnProps {
  stage: CRMStage;
  cards: CRMCard[];
  onCardClick: (card: CRMCard) => void;
   followupMap?: Map<string, CRMFollowupInfo>;
}

 export function CRMPipelineColumn({ stage, cards, onCardClick, followupMap }: CRMPipelineColumnProps) {
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  // Reset pagination when cards change
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [cards.length]);

  const displayedCards = cards.slice(0, visibleCount);
  const hasMore = cards.length > visibleCount;
  const remaining = Math.min(ITEMS_PER_PAGE, cards.length - visibleCount);

  const handleLoadMore = () => {
    setVisibleCount((prev) => Math.min(prev + ITEMS_PER_PAGE, cards.length));
  };

  return (
    <div className="flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg">
      {/* Column Header */}
      <div
        className="p-3 rounded-t-lg flex items-center justify-between"
        style={{ backgroundColor: `${stage.color}20` }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: stage.color }}
          />
          <h3 className="font-medium text-sm">{stage.name}</h3>
        </div>
        <Badge variant="secondary" className="text-xs">
          {cards.length}
        </Badge>
      </div>

      {/* Cards Container - No scroll, page scrolls */}
      <div className="flex-1 p-2">
        <div className="space-y-2">
          {cards.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum lead neste estágio
            </div>
          ) : (
            <>
              {displayedCards.map((card) => (
                <CRMLeadCard
                  key={card.id}
                  card={card}
                  onClick={() => onCardClick(card)}
                   followupInfo={followupMap?.get(`${card.cod_agent}::${card.whatsapp_number}`)}
                />
              ))}

              {hasMore && (
                <div className="pt-2 border-t border-border/50 text-center space-y-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadMore}
                    className="w-full gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Ver mais ({remaining})
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Exibindo {visibleCount} de {cards.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
