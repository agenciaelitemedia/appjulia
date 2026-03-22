import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSipPhone } from '@/pages/telefonia/hooks/useSipPhone';
import { SoftphoneWidget } from '@/pages/telefonia/components/SoftphoneWidget';

interface PhoneCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  contactName: string;
  codAgent: string;
}

export function PhoneCallDialog({ open, onOpenChange, whatsappNumber, contactName, codAgent }: PhoneCallDialogProps) {
  const [selectedExtension, setSelectedExtension] = useState('');
  const sip = useSipPhone();

  // Fetch agent's active extensions
  const { data: extensions = [] } = useQuery({
    queryKey: ['my-extensions-for-call', codAgent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*')
        .eq('cod_agent', codAgent)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!codAgent,
  });

  const handleSelectExtension = useCallback(async (extId: string) => {
    setSelectedExtension(extId);

    if (sip.status !== 'idle') sip.disconnect();

    const ext = extensions.find((e: any) => String(e.id) === extId);
    if (!ext) return;

    try {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'get_sip_credentials', codAgent, extensionId: ext.id },
      });
      if (error || data?.error) return;
      sip.connect(data.data);
    } catch {
      // SIP not available
    }
  }, [extensions, codAgent, sip]);

  const dial = useMutation({
    mutationFn: async () => {
      const ext = extensions.find((e: any) => String(e.id) === selectedExtension);
      const extensionNumber = (ext as any)?.api4com_ramal || (ext as any)?.extension_number || '';

      if (sip.status === 'registered') {
        sip.call(whatsappNumber);
        return { via: 'sip' };
      }

      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'dial', codAgent, extension: extensionNumber, phone: whatsappNumber },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (result) => {
      if (result?.via === 'sip') {
        toast.success(`Discando para ${contactName} via SIP...`);
      } else {
        toast.success(`Ligando para ${contactName}...`);
        onOpenChange(false);
      }
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const sipStatusLabel = sip.status === 'registered' ? 'SIP ativo' : sip.status === 'idle' ? '' : sip.status;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
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
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Ramal de origem</label>
            <Select value={selectedExtension} onValueChange={handleSelectExtension}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ramal..." />
              </SelectTrigger>
              <SelectContent>
                {extensions.map((ext: any) => (
                  <SelectItem key={ext.id} value={String(ext.id)}>
                    {ext.extension_number} {ext.label ? `(${ext.label})` : ''}
                    {ext.api4com_ramal ? ` → ${ext.api4com_ramal}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {extensions.length === 0 && (
              <p className="text-xs text-destructive mt-1">Nenhum ramal ativo encontrado</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => dial.mutate()}
            disabled={!selectedExtension || dial.isPending || sip.status === 'calling'}
            className="gap-2"
          >
            {dial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {dial.isPending ? 'Discando...' : sip.status === 'registered' ? 'Ligar (SIP)' : 'Ligar'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Softphone Widget for active calls */}
      <SoftphoneWidget
        status={sip.status}
        duration={sip.duration}
        isMuted={sip.isMuted}
        isHeld={sip.isHeld}
        callerInfo={sip.callerInfo || contactName}
        onAnswer={sip.answer}
        onHangup={sip.hangup}
        onToggleMute={sip.toggleMute}
        onToggleHold={sip.toggleHold}
        onSendDTMF={sip.sendDTMF}
      />
    </Dialog>
  );
}
