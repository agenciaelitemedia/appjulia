import { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2, PhoneOff } from 'lucide-react';
import { usePhone } from '@/contexts/PhoneContext';
import { formatPhoneForDialing } from '@/lib/phoneFormat';

interface PhoneCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  contactName: string;
  codAgent: string;
}

export function PhoneCallDialog({ open, onOpenChange, whatsappNumber, contactName }: PhoneCallDialogProps) {
  const { isAvailable, myExtension, sip, dialNumber, isDialing, setSoftphoneCentered } = usePhone();

  const phoneInfo = useMemo(() => formatPhoneForDialing(whatsappNumber), [whatsappNumber]);

  const sipStatusLabel = sip.status === 'registered' ? 'SIP ativo' : sip.status === 'error' ? 'SIP erro' : sip.status === 'idle' ? '' : sip.status;

  const handleDial = async () => {
    onOpenChange(false);
    setSoftphoneCentered(true);
    await dialNumber(whatsappNumber, contactName, 'CRM', whatsappNumber);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isAvailable ? (
              <Phone className="h-5 w-5 text-primary" />
            ) : (
              <PhoneOff className="h-5 w-5 text-muted-foreground" />
            )}
            Ligar para {contactName}
            {sipStatusLabel && (
              <Badge variant="secondary" className="text-xs">
                {sipStatusLabel}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center">
            <p className="text-2xl font-mono font-bold tracking-wider">{whatsappNumber}</p>
            <p className="text-sm text-muted-foreground mt-1">{contactName}</p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <span className="text-xs text-muted-foreground">Discar:</span>
              <span className="text-xs font-mono font-medium">{phoneInfo.formatted}</span>
              <Badge variant="outline" className="text-[10px] h-5">
                {phoneInfo.type === 'mobile' ? 'Cel' : phoneInfo.type === 'landline' ? 'Fixo' : '?'}
              </Badge>
              {phoneInfo.ninthAdded && (
                <Badge variant="secondary" className="text-[10px] h-5 bg-yellow-500/10 text-yellow-600">+9°</Badge>
              )}
            </div>
          </div>

          {!isAvailable ? (
            <div className="text-center py-4 space-y-2">
              <PhoneOff className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Você não possui ramal ativo.</p>
              <p className="text-xs text-muted-foreground">Solicite ao administrador.</p>
            </div>
          ) : myExtension && (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Ramal: </span>
                <span className="font-medium">
                  {myExtension.extension_number} {myExtension.label ? `(${myExtension.label})` : ''}
                </span>
              </div>
              {myExtension.api4com_ramal && (
                <Badge variant="outline" className="text-[10px] h-5">
                  {myExtension.api4com_ramal}
                </Badge>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleDial}
            disabled={!isAvailable || isDialing || sip.status === 'calling'}
            className="gap-2"
          >
            {isDialing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {isDialing ? 'Discando...' : 'Ligar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
