import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CRMCard, CRMStage } from '../types';
import { CRMLeadCard } from './CRMLeadCard';

interface CRMPipelineColumnProps {
  stage: CRMStage;
  cards: CRMCard[];
  onCardClick: (card: CRMCard) => void;
}

export function CRMPipelineColumn({ stage, cards, onCardClick }: CRMPipelineColumnProps) {
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

      {/* Cards Container */}
      <ScrollArea className="flex-1 p-2" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <div className="space-y-2">
          {cards.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Nenhum lead neste estágio
            </div>
          ) : (
            cards.map((card) => (
              <CRMLeadCard
                key={card.id}
                card={card}
                onClick={() => onCardClick(card)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
