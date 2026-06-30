import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PhoneCall } from 'lucide-react';

export default function WavoipPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PhoneCall className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Wavoip</h1>
          <p className="text-sm text-muted-foreground">Chamadas de voz WhatsApp</p>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Em breve</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          O discador Wavoip e o histórico das suas chamadas aparecerão aqui assim que o seu dispositivo for provisionado.
        </CardContent>
      </Card>
    </div>
  );
}