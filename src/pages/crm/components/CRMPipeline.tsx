import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CRMCard, CRMStage } from '../types';
import { CRMPipelineColumn } from './CRMPipelineColumn';

interface CRMPipelineProps {
  stages: CRMStage[];
  cards: CRMCard[];
  onCardClick: (card: CRMCard) => void;
}

export function CRMPipeline({ stages, cards, onCardClick }: CRMPipelineProps) {
  const getCardsForStage = (stageId: number) => {
    return cards.filter((card) => card.stage_id === stageId);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4">
        {stages.map((stage) => (
          <CRMPipelineColumn
            key={stage.id}
            stage={stage}
            cards={getCardsForStage(stage.id)}
            onCardClick={onCardClick}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
