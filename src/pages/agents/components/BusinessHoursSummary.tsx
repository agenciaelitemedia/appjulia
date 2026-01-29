import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  checkBusinessHours,
  formatScheduleSummary,
  getTimezoneLabel,
  type BusinessHoursSchedule,
} from '@/lib/businessHoursUtils';

interface BusinessHoursSummaryProps {
  settings: Record<string, unknown> | null;
}

export function BusinessHoursSummary({ settings }: BusinessHoursSummaryProps) {
  const result = checkBusinessHours(settings);

  // If business hours not enabled
  if (!result.enabled) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Horário de Atendimento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              24h
            </Badge>
            <span className="text-muted-foreground">Atendimento sem restrição de horário</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const schedule = settings?.BUSINESS_HOURS_SCHEDULE as BusinessHoursSchedule;
  const timezone = (settings?.BUSINESS_HOURS_TIMEZONE as string) || 'America/Sao_Paulo';
  const offMessage = settings?.BUSINESS_HOURS_OFF_MESSAGE as string;
  const scheduleLines = schedule ? formatScheduleSummary(schedule) : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Horário de Atendimento
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant="default" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Ativo
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fuso:</span>
            <span className="text-sm font-medium">{getTimezoneLabel(timezone)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Agora:</span>
            {result.isWithinHours ? (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Aberto
              </Badge>
            ) : (
              <Badge variant="secondary" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                Fechado
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Schedule Lines */}
        <div className="space-y-1">
          {scheduleLines.map((line, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-sm">•</span>
              <span className="text-sm">{line}</span>
            </div>
          ))}
        </div>

        {/* Off Message */}
        {offMessage && (
          <>
            <Separator />
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Mensagem fora do horário:</span>
              <p className="text-sm italic bg-muted/50 p-3 rounded-md">"{offMessage}"</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
