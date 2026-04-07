import { Card, CardContent } from '@/components/ui/card';
import { ComercialCard, ComercialStage } from '../types';

interface Props {
  cards: ComercialCard[];
  stages: ComercialStage[];
}

export function ComercialTotalizers({ cards, stages }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
      {stages.map((stage) => {
        const count = cards.filter((c) => c.stage_id === stage.id).length;
        return (
          <Card key={stage.id} className="border-l-4" style={{ borderLeftColor: stage.color }}>
            <CardContent className="p-3">
              <p className="text-2xl font-bold">{count}</p>
              <p className="text-xs text-muted-foreground line-clamp-1" title={stage.name}>{stage.name}</p>
            </CardContent>
          </Card>
        );
      })}
      <Card className="border-l-4 border-l-primary bg-primary/5">
        <CardContent className="p-3">
          <p className="text-2xl font-bold text-primary">{cards.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </CardContent>
      </Card>
    </div>
  );
}
