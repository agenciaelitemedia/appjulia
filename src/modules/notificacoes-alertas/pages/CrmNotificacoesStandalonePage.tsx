import { BellRing } from 'lucide-react';
import { PhoneProvider } from '../extend/crm';
import { CrmNotificacoesTab } from '../components/CrmNotificacoesTab';

export default function CrmNotificacoesStandalonePage() {
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
              Acompanhe os leads alertados e as ações de recuperação
            </p>
          </div>
        </div>
        <CrmNotificacoesTab />
      </div>
    </PhoneProvider>
  );
}
