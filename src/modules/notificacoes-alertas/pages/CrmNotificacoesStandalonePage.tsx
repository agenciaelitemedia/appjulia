import { BellRing } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PhoneProvider } from '../extend/crm';
import { CrmNotificacoesTab } from '../components/CrmNotificacoesTab';
import { parseCodEtapaParam, getTriggerByCode } from '../module';

export default function CrmNotificacoesStandalonePage() {
  const [searchParams] = useSearchParams();
  const codEtapas = useMemo(
    () => parseCodEtapaParam(searchParams.get('codEtapa')),
    [searchParams],
  );
  const stageNames = codEtapas.map((c) => getTriggerByCode(c)?.label).filter(Boolean).join(' • ');

  return (
    <PhoneProvider>
      <div className="min-h-screen bg-background p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <BellRing className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">CRM de Notificações</h1>
            <p className="text-sm text-muted-foreground">
              {stageNames || 'Acompanhe os leads alertados e as ações de recuperação'}
            </p>
          </div>
        </div>
        <CrmNotificacoesTab codEtapas={codEtapas} />
      </div>
    </PhoneProvider>
  );
}
