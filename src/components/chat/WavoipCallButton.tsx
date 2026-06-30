import { Button } from '@/components/ui/button';
import { PhoneCall } from 'lucide-react';
import { useWavoip } from '@/contexts/WavoipContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Props {
  phone?: string | null;
  contactName?: string | null;
}

export function WavoipCallButton({ phone, contactName }: Props) {
  const { hasActivePlan, ready, canDial, startCall } = useWavoip();
  if (!hasActivePlan) return null;

  const onClick = async () => {
    if (!phone) { toast.error('Contato sem telefone'); return; }
    if (!ready) { toast.error('Webphone Wavoip carregando...'); return; }
    if (!canDial) { toast.error('Conecte um dispositivo Wavoip para ligar'); return; }
    const res = await startCall(phone, contactName ?? undefined);
    if (!res.ok) toast.error(res.error ?? 'Falha ao ligar');
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn('gap-1.5', canDial
        ? 'bg-emerald-50 text-emerald-700 border-emerald-500 hover:bg-emerald-100'
        : 'text-muted-foreground')}
      onClick={onClick}
      title="Chamar via WhatsApp (Wavoip)"
    >
      <PhoneCall className="h-4 w-4" />
      Chamada WA
    </Button>
  );
}