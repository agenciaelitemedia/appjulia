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
    <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1">
      {/* Stage cards */}
      {stages.map((stage, index) => {
        const count = getCountForStage(stage.id);
        const pctTotal = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
        const prevCount = index > 0 ? getCountForStage(stages[index - 1].id) : 0;
        const pctPrev = index > 0 && prevCount > 0 ? (count / prevCount) * 100 : 0;
        return (
          <Card
            key={stage.id}
            className="border-l-2"
            style={{ borderLeftColor: stage.color }}
          >
            <CardContent className="p-2">
              <div className="flex items-baseline gap-1">
                <p className="text-base font-bold leading-tight">{count}</p>
                <span className="text-[10px] font-medium text-muted-foreground leading-tight">
                  {pctTotal.toFixed(1).replace('.', ',')}% tot
                </span>
              </div>
              {index > 0 && (
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                  {pctPrev.toFixed(1).replace('.', ',')}% da anterior
                </p>
              )}
              <p
                className="text-[10px] text-muted-foreground line-clamp-1 leading-tight"
                title={`${stage.name} — ${pctTotal.toFixed(1).replace('.', ',')}% do total`}
              >
                {stage.name}
              </p>
            </CardContent>
          </Card>
        );
      })}

      {/* Total card */}
      <Card className="border-l-2 border-l-primary bg-primary/5">
        <CardContent className="p-2">
          <p className="text-base font-bold text-primary leading-tight">{totalLeads}</p>
          <p className="text-[10px] text-muted-foreground leading-tight">Total</p>
        </CardContent>
      </Card>
    </div>
  );
}

