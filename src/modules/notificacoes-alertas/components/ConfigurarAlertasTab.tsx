import { Loader2 } from 'lucide-react';
import { ALERT_TRIGGERS } from '../module';
import { useAlertConfigs } from '../hooks/useAlertConfigs';
import { AlertTriggerCard } from './AlertTriggerCard';
import { MascoteLoader } from "@/components/ui/mascote-loader";

export function ConfigurarAlertasTab({ codAgent }: { codAgent: string }) {
  const { data: configs = [], isLoading } = useAlertConfigs(codAgent);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <MascoteLoader size="xs" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {ALERT_TRIGGERS.map((trigger) => (
        <AlertTriggerCard
          key={trigger.key}
          codAgent={codAgent}
          trigger={trigger}
          config={configs.find((c) => c.trigger_key === trigger.key)}
        />
      ))}
    </div>
  );
}
