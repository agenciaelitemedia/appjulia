import { useState } from 'react';
import { Phone, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePhone } from '@/contexts/PhoneContext';
import { cn } from '@/lib/utils';
import { maskPhone } from '@/lib/inputMasks';

const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

const sipStatusLabel: Record<string, string> = {
  idle: 'Offline',
  registering: 'Conectando...',
  registered: 'Disponível',
  calling: 'Discando',
  ringing: 'Tocando',
  'in-call': 'Em chamada',
  error: 'Erro SIP',
};

export function HeaderDialer() {
  const { sip, isAvailable, dialNumber, isDialing, showSoftphone, setShowSoftphone, setSoftphoneCentered } = usePhone();
  const [number, setNumber] = useState('');
  const [open, setOpen] = useState(false);

  if (!isAvailable) return null;

  const isActive = ['calling', 'ringing', 'in-call'].includes(sip.status);
  const isRegistered = sip.status === 'registered';
  const dotColor = isRegistered || sip.status === 'in-call' ? 'bg-green-500' :
    sip.status === 'error' ? 'bg-destructive' :
    sip.status === 'idle' ? 'bg-muted-foreground' : 'bg-yellow-500 animate-pulse';

  const handleDial = async () => {
    if (!number) return;
    setOpen(false);
    setSoftphoneCentered(true);
    await dialNumber(number, undefined, 'DISCADOR');
    setNumber('');
  };

  const handleShowSoftphone = () => {
    setOpen(false);
    setShowSoftphone(true);
  };

  const badgeColor = isRegistered || sip.status === 'in-call'
    ? 'bg-green-500/15 text-green-700 border-green-500/30'
    : sip.status === 'error'
    ? 'bg-destructive/15 text-destructive border-destructive/30'
    : sip.status === 'idle'
    ? 'bg-muted text-muted-foreground border-border'
    : 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30';

  const badgeLabel = isRegistered ? 'Disponível' : sip.status === 'in-call' ? 'Em chamada' :
    sip.status === 'error' ? 'Indisponível' : sip.status === 'idle' ? 'Offline' : 'Conectando...';

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 h-5 gap-1 font-medium hidden sm:inline-flex', badgeColor)}>
        <span className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
        {badgeLabel}
      </Badge>

      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Phone className="h-5 w-5" />
                <span className={cn('absolute top-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-background sm:hidden', dotColor)} />
                <span className="sr-only">Softphone</span>
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Softphone — {sipStatusLabel[sip.status] || sip.status}
          </TooltipContent>
        </Tooltip>

        <PopoverContent align="end" className="w-72 p-3">
          <div className="space-y-3">
            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', dotColor)} />
                <span className="text-sm font-medium">{sipStatusLabel[sip.status] || sip.status}</span>
              </div>
              {isActive && (
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleShowSoftphone}>
                  Ver chamada
                </Button>
              )}
            </div>

            {!isActive && (
              <>
                {/* Number input */}
                <Input
                  value={maskPhone(number)}
                  onChange={(e) => setNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Digite o número..."
                  className="text-center text-lg font-mono tracking-wider h-11"
                />

                {/* DTMF Pad */}
                <div className="grid grid-cols-3 gap-1.5">
                  {keys.map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      className="h-10 text-base font-mono"
                      onClick={() => setNumber(prev => prev + key)}
                    >
                      {key}
                    </Button>
                  ))}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="h-10" onClick={() => setNumber(prev => prev.slice(0, -1))} disabled={!number}>
                    <Delete className="h-4 w-4" />
                  </Button>
                  <Button size="sm" className="h-10" onClick={handleDial} disabled={!number || !isRegistered || isDialing}>
                    <Phone className="h-4 w-4 mr-1.5" />
                    Ligar
                  </Button>
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
