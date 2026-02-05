import { useRef } from 'react';
 import { CRMCard, CRMStage, CRMFollowupInfo } from '../types';
import { CRMPipelineColumn } from './CRMPipelineColumn';
import { CRMScrollNavigation } from './CRMScrollNavigation';

interface CRMPipelineProps {
  stages: CRMStage[];
  cards: CRMCard[];
  onCardClick: (card: CRMCard) => void;
   followupMap?: Map<string, CRMFollowupInfo>;
}

 export function CRMPipeline({ stages, cards, onCardClick, followupMap }: CRMPipelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getCardsForStage = (stageId: number) => {
    return cards.filter((card) => card.stage_id === stageId);
  };

  return (
    <div className="flex flex-col flex-1">
      <div
        ref={scrollRef}
        className="flex gap-4 pb-16 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {stages.map((stage) => (
          <CRMPipelineColumn
            key={stage.id}
            stage={stage}
            cards={getCardsForStage(stage.id)}
            onCardClick={onCardClick}
             followupMap={followupMap}
          />
        ))}
      </div>
      <CRMScrollNavigation scrollRef={scrollRef} />
    </div>
  );
}
