import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneCall } from 'lucide-react';
import { useWavoip } from '@/contexts/WavoipContext';
import { cn } from '@/lib/utils';
import { WavoipCallDialog } from './WavoipCallDialog';
import { UpsellCallDialog } from './UpsellCallDialog';

interface Props {
  phone?: string | null;
  contactName?: string | null;
  queueId?: string | null;
}

export function WavoipCallButton({ phone, contactName, queueId }: Props) {
  const { hasActivePlan, ready, canDial } = useWavoip();
  const [open, setOpen] = useState(false);
  const [showUpsell, setShowUpsell] = useState(false);

  const unavailable = !hasActivePlan || !ready || !canDial || !phone;

  const onClick = () => {
    if (unavailable) {
      setShowUpsell(true);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'gap-1.5',
          unavailable
            ? 'opacity-60 text-muted-foreground border-border hover:bg-muted'
            : 'bg-emerald-50 text-emerald-700 border-emerald-500 hover:bg-emerald-100',
        )}
        onClick={onClick}
        title={unavailable ? 'ZAP Call indisponível' : 'Iniciar ZAP Call (Wavoip)'}
      >
        <PhoneCall className="h-4 w-4" />
        ZAP Call
      </Button>
      {phone && !unavailable ? (
        <WavoipCallDialog
          open={open}
          onOpenChange={setOpen}
          phone={phone}
          contactName={contactName}
          queueId={queueId}
        />
      ) : null}
      <UpsellCallDialog open={showUpsell} onOpenChange={setShowUpsell} product="zap" />
    </>
  );
}