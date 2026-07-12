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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useWavoip } from '@/contexts/WavoipContext';
import { maskPhone } from '@/lib/inputMasks';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function deviceLabel(name: string | null, token: string): string {
  if (name && name.trim().length > 0) return name;
  return `Dispositivo ••${token.slice(-6)}`;
}

export function HeaderZapDialerDialog({ open, onOpenChange }: Props) {
  const { devices, startCall } = useWavoip();
  const connected = useMemo(
    () => devices.filter((d) => d.connection_status === 'connected'),
    [devices],
  );
  const [deviceId, setDeviceId] = useState<string>('');
  const [number, setNumber] = useState('');
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (connected.length === 1) {
      setDeviceId(connected[0].id);
    } else if (deviceId && !connected.some((d) => d.id === deviceId)) {
      setDeviceId('');
    }
  }, [open, connected, deviceId]);

  useEffect(() => {
    if (!open) {
      setNumber('');
      setCalling(false);
    }
  }, [open]);

  const digits = number.replace(/\D/g, '');
  const canCall = !!deviceId && digits.length >= 8 && !calling;
  const hasDevice = connected.length > 0;

  const handleClose = () => {
    if (calling) return;
    onOpenChange(false);
  };

  const handleCall = async () => {
    if (!canCall) return;
    setCalling(true);
    const res = await startCall(digits, { deviceId });
    setCalling(false);
    if (!res.ok) {
      toast.error(res.error ?? 'Falha ao iniciar chamada');
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? handleClose() : onOpenChange(v))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Iniciar ZAP Call</DialogTitle>
          <DialogDescription>
            Escolha o dispositivo e digite o número de WhatsApp para ligar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Dispositivo</label>
            {hasDevice ? (
              <Select value={deviceId} onValueChange={setDeviceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um dispositivo..." />
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

          <div className="space-y-2">
            <label className="text-sm font-medium">Número</label>
            <Input
              value={maskPhone(number)}
              onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Digite o número com DDD..."
              className="text-center text-lg font-mono tracking-wider h-11"
              inputMode="tel"
              autoFocus
            />
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
            disabled={!canCall}
            title="Ligar"
          >
            <Phone className="h-6 w-6" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}