import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PhoneCall } from 'lucide-react';
import { useWavoip } from '@/contexts/WavoipContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { WavoipCallDialog } from './WavoipCallDialog';

interface Props {
  phone?: string | null;
  contactName?: string | null;
  queueId?: string | null;
}

export function WavoipCallButton({ phone, contactName, queueId }: Props) {
  const { hasActivePlan, ready, canDial } = useWavoip();
  const [open, setOpen] = useState(false);
  if (!hasActivePlan) return null;

  const onClick = () => {
    if (!phone) { toast.error('Contato sem telefone'); return; }
    if (!ready) { toast.error('Webphone Wavoip carregando...'); return; }
    if (!canDial) { toast.error('Conecte um dispositivo Wavoip para ligar'); return; }
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={cn('gap-1.5', canDial
          ? 'bg-emerald-50 text-emerald-700 border-emerald-500 hover:bg-emerald-100'
          : 'text-muted-foreground')}
        onClick={onClick}
        title="Iniciar ZAP Call (Wavoip)"
      >
        <PhoneCall className="h-4 w-4" />
        ZAP Call
      </Button>
      {phone ? (
        <WavoipCallDialog
          open={open}
          onOpenChange={setOpen}
          phone={phone}
          contactName={contactName}
          queueId={queueId}
        />
      ) : null}
    </>
  );
}