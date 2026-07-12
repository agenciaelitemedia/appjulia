import { useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWavoip } from '@/contexts/WavoipContext';
import { cn } from '@/lib/utils';
import { UpsellCallDialog } from '@/components/chat/UpsellCallDialog';

export function HeaderZapCallBadge() {
  const { hasActivePlan, ready, canDial } = useWavoip();
  const [showUpsell, setShowUpsell] = useState(false);

  const available = hasActivePlan && ready && canDial;

  const badgeClass = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:opacity-80',
    available
      ? 'bg-green-500/15 text-green-700 border-green-500/30 cursor-default'
      : 'bg-muted text-muted-foreground border-border opacity-70 cursor-pointer',
  );

  const tooltipText = available
    ? 'Ligação pelo WhatsApp — disponível'
    : 'ZAP Call indisponível — clique para saber como contratar';

  const onClick = () => {
    if (!available) setShowUpsell(true);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className={badgeClass} onClick={onClick}>
            <span className={cn('h-1.5 w-1.5 rounded-full', available ? 'bg-green-500' : 'bg-muted-foreground')} />
            <PhoneCall className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">ZAP Call</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltipText}</TooltipContent>
      </Tooltip>
      <UpsellCallDialog open={showUpsell} onOpenChange={setShowUpsell} product="zap" />
    </>
  );
}