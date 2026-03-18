import { AlertTriangle, Info, Flame, Clock, TrendingUp, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const severityStyles: Record<string, string> = {
  critical: 'border-l-4 border-l-destructive bg-destructive/5',
  warning: 'border-l-4 border-l-yellow-500 bg-yellow-500/5',
  info: 'border-l-4 border-l-primary bg-primary/5',
};

const severityBadge: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  warning: 'bg-yellow-500 text-white',
  info: 'bg-primary text-primary-foreground',
};

const typeIcons: Record<string, typeof Info> = {
  stuck_lead: Clock,
  hot_opportunity: Flame,
  risk: AlertTriangle,
  follow_up_needed: TrendingUp,
  summary: Info,
};

const typeLabels: Record<string, string> = {
  stuck_lead: 'Lead Parado',
  hot_opportunity: 'Oportunidade Quente',
  risk: 'Risco',
  follow_up_needed: 'Follow-up Necessário',
  summary: 'Resumo',
};

interface Props {
  insight: any;
}

export function InsightDetailCard({ insight }: Props) {
  const navigate = useNavigate();
  const Icon = typeIcons[insight.insight_type] || Info;
  const style = severityStyles[insight.severity] || severityStyles.info;

  const relatedCards = Array.isArray(insight.related_cards) ? insight.related_cards : [];

  const handleLeadClick = (card: any) => {
    const search = card.whatsapp_number || card.phone || card.contact_name || '';
    const dateStr = format(new Date(insight.created_at), 'yyyy-MM-dd');
    navigate(`/crm/leads?search=${encodeURIComponent(search)}&dateFrom=${dateStr}&dateTo=${dateStr}`);
  };

  return (
    <div className={cn('rounded-lg p-4', style)}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 shrink-0 text-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <p className="text-sm font-semibold leading-tight">{insight.title}</p>
            <Badge variant="outline" className={cn('text-[10px] h-5', severityBadge[insight.severity])}>
              {insight.severity}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5">
              {typeLabels[insight.insight_type] || insight.insight_type}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>

          {/* Related cards (clickable leads) */}
          {relatedCards.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {relatedCards.map((card: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => handleLeadClick(card)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-background border border-border hover:bg-accent transition-colors cursor-pointer"
                >
                  <span className="font-medium">{card.contact_name || card.contact || 'Lead'}</span>
                  {card.whatsapp_number && (
                    <span className="text-muted-foreground">• {card.whatsapp_number}</span>
                  )}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
            <span>Agente: {insight.cod_agent}</span>
            <span>{format(new Date(insight.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            {insight.is_read && <span className="text-green-600">Lido</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
