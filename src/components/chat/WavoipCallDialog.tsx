import { useEffect, useMemo, useState } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWavoip } from '@/contexts/WavoipContext';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phone: string;
  contactName?: string | null;
}

function formatPhone(phone: string): string {
  const d = (phone || '').replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 (${d.slice(2, 4)}) ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return phone;
}

function deviceLabel(name: string | null, token: string): string {
  if (name && name.trim().length > 0) return name;
  return `Dispositivo ••${token.slice(-6)}`;
}

export function WavoipCallDialog({ open, onOpenChange, phone, contactName }: Props) {
  const { devices, startCall } = useWavoip();
  const connected = useMemo(
    () => devices.filter((d) => d.connection_status === 'connected'),
    [devices],
  );
  const [deviceId, setDeviceId] = useState<string>('');
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (connected.length > 0 && !connected.some((d) => d.id === deviceId)) {
      setDeviceId(connected[0].id);
    }
  }, [open, connected, deviceId]);

  const handleClose = () => {
    if (calling) return;
    onOpenChange(false);
  };

  const handleCall = async () => {
    if (!deviceId) return;
    setCalling(true);
    const res = await startCall(phone, { deviceId });
    setCalling(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Falha ao iniciar chamada');
      return;
    }
    onOpenChange(false);
  };

  const hasDevice = connected.length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar chamada WhatsApp</DialogTitle>
          <DialogDescription>
            Confirme os dados e escolha o dispositivo que fará a ligação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/40 p-3">
            <div className="text-xs text-muted-foreground">Ligar para</div>
            <div className="text-base font-medium">{contactName || 'Contato'}</div>
            <div className="text-sm text-muted-foreground">{formatPhone(phone)}</div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Dispositivo</label>
            {hasDevice ? (
              <Select
                value={deviceId}
                onValueChange={setDeviceId}
                disabled={connected.length <= 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dispositivo" />
                </SelectTrigger>
                <SelectContent>
                  {connected.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {deviceLabel(d.name, d.token)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                Nenhum dispositivo Wavoip conectado.{' '}
                <Link
                  to="/wavoip"
                  className="text-primary underline underline-offset-2"
                  onClick={() => onOpenChange(false)}
                >
                  Conectar dispositivo
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-center gap-6 pt-2">
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="h-14 w-14 rounded-full"
            onClick={handleClose}
            disabled={calling}
            title="Cancelar"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="h-14 w-14 rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={handleCall}
            disabled={!hasDevice || !deviceId || calling}
            title="Ligar"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}