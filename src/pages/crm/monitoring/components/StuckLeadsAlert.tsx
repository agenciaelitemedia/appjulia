import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, ExternalLink, Phone } from 'lucide-react';
import { CRMStuckLead } from '../../types';

interface StuckLeadsAlertProps {
  leads: CRMStuckLead[];
  isLoading?: boolean;
}

function getSeverityColor(days: number): string {
  if (days >= 14) return 'destructive';
  if (days >= 10) return 'default'; // orange-ish via CSS
  return 'secondary'; // yellow-ish
}

function getSeverityIcon(days: number) {
  if (days >= 14) return '🔴';
  if (days >= 10) return '🟠';
  return '🟡';
}

export function StuckLeadsAlert({ leads, isLoading }: StuckLeadsAlertProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 text-chart-2" />
            <p className="font-medium">Nenhum lead parado!</p>
            <p className="text-sm">Todos os leads estão fluindo normalmente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ScrollArea className="h-[320px]">
          <div className="divide-y divide-border">
            {leads.map((lead) => (
              <div 
                key={lead.id} 
                className="p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{getSeverityIcon(lead.days_stuck)}</span>
                      <p className="font-medium text-foreground truncate">
                        {lead.contact_name || lead.whatsapp_number}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                        style={{ borderColor: lead.stage_color, color: lead.stage_color }}
                      >
                        {lead.stage_name}
                      </Badge>
                      <Badge 
                        variant={lead.days_stuck >= 14 ? 'destructive' : lead.days_stuck >= 10 ? 'default' : 'secondary'} 
                        className="text-xs"
                      >
                        {lead.days_stuck} dias
                      </Badge>
                    </div>
                    {lead.business_name && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {lead.business_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      asChild
                    >
                      <a 
                        href={`https://wa.me/${lead.whatsapp_number?.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="h-4 w-4" />
                      </a>
                    </Button>
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
