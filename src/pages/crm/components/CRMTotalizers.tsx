import { Card, CardContent } from '@/components/ui/card';
import { CRMCard, CRMStage } from '../types';

interface CRMTotalizersProps {
  cards: CRMCard[];
  stages: CRMStage[];
}

export function CRMTotalizers({ cards, stages }: CRMTotalizersProps) {
  const getCountForStage = (stageId: number) => {
    return cards.filter((card) => card.stage_id === stageId).length;
  };

  const totalLeads = cards.length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {/* Stage cards */}
      {stages.map((stage) => {
        const count = getCountForStage(stage.id);
        return (
          <Card
            key={stage.id}
            className="border-l-4"
            style={{ borderLeftColor: stage.color }}
          >
            <CardContent className="p-3">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground line-clamp-1" title={stage.name}>
                {stage.name}
              </p>
            </CardContent>
          </Card>
        );
      })}

      {/* Total card */}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="p-3">
          <p className="text-2xl font-bold text-primary">{totalLeads}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent>
      </Card>
    </div>
  );
}
