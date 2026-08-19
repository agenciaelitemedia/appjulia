import { Card, CardContent } from '@/components/ui/card';
import { BellRing } from 'lucide-react';

export function GeralTab() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <BellRing className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          A visão geral dos alertas será disponibilizada aqui.
        </p>
      </CardContent>
    </Card>
  );
}
