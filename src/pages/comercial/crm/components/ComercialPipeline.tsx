import { useRef } from 'react';
import { ComercialCard, ComercialStage } from '../types';
import { ComercialPipelineColumn } from './ComercialPipelineColumn';
import { CRMScrollNavigation } from '@/pages/crm/components/CRMScrollNavigation';
import { useMoveComercialCard } from '../hooks/useCrmComercialData';
import { toast } from 'sonner';

interface Props {
  stages: ComercialStage[];
  cards: ComercialCard[];
  onCardClick: (card: ComercialCard) => void;
}

export function ComercialPipeline({ stages, cards, onCardClick }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const moveMutation = useMoveComercialCard();

  const handleMoveCard = (cardId: number, fromStageId: number, toStageId: number) => {
    moveMutation.mutate(
      { cardId, fromStageId, toStageId },
      {
        onSuccess: () => toast.success('Card movido com sucesso'),
        onError: (err: any) => toast.error(err.message || 'Erro ao mover card'),
      }
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <div
        ref={scrollRef}
        className="flex gap-4 pb-16 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {stages.map((stage) => (
          <ComercialPipelineColumn
            key={stage.id}
            stage={stage}
            cards={cards.filter((c) => c.stage_id === stage.id)}
            onCardClick={onCardClick}
            onMoveCard={handleMoveCard}
          />
        ))}
      </div>
      <CRMScrollNavigation scrollRef={scrollRef} />
    </div>
  );
}
