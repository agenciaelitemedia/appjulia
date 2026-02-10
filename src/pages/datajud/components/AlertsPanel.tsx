import { Bell, CheckCheck, MessageCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProcessAlerts } from '../hooks/useProcessAlerts';

export function AlertsPanel() {
  const { alerts, unreadCount, markAsRead, markAllAsRead } = useProcessAlerts();

  if (alerts.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alertas Recentes
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">{unreadCount}</Badge>
            )}
          </CardTitle>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Marcar todas como lidas
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[250px]">
          <div className="space-y-2">
            {alerts.slice(0, 10).map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                  alert.is_read ? 'bg-card' : 'bg-primary/5 border-primary/20'
                }`}
                onClick={() => {
                  if (!alert.is_read) markAsRead.mutate(alert.id);
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {(alert.process as any)?.name || 'Processo'}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {(alert.process as any)?.process_number_formatted}
                    </p>
                    <p className="text-xs mt-1">
                      {(alert.movement_data as any)?.nome || 'Nova movimentação'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {alert.whatsapp_sent ? (
                      <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                    ) : alert.whatsapp_error ? (
                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : null}
                    <span className="text-xs text-muted-foreground">
                      {new Date(alert.created_at).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
