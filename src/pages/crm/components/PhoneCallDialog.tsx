import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Phone, Loader2, AlertCircle, PhoneOff } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useSipPhone, type CallEndedInfo } from '@/pages/telefonia/hooks/useSipPhone';
import { useSyncQueue } from '@/pages/telefonia/hooks/useSyncQueue';
import { SoftphoneWidget } from '@/pages/telefonia/components/SoftphoneWidget';
import { formatPhoneForDialing } from '@/lib/phoneFormat';
interface PhoneCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  contactName: string;
  codAgent: string;
}

export function PhoneCallDialog({ open, onOpenChange, whatsappNumber, contactName, codAgent }: PhoneCallDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedExtension, setSelectedExtension] = useState('');
  const [sipError, setSipError] = useState('');
  const [showSoftphone, setShowSoftphone] = useState(false);
  const autoConnected = useRef(false);

  // Sync call history after call ends (replaces complete_call_log)
  const handleCallEnded = useCallback((_info: CallEndedInfo) => {
    setTimeout(() => {
      const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      supabase.functions.invoke('api4com-proxy', {
        body: { action: 'sync_call_history', codAgent, since },
      }).then(({ data, error }) => {
        queryClient.invalidateQueries({ queryKey: ['my-call-history'] });
        if (!error && !data?.error) {
          toast.success(`Histórico sincronizado: ${data?.data?.synced || 0} registros`);
        }
      }).catch(console.error);
    }, 3000);
  }, [codAgent, queryClient]);

  const sip = useSipPhone(handleCallEnded);

  const phoneInfo = useMemo(() => formatPhoneForDialing(whatsappNumber), [whatsappNumber]);

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

  const myExtension = useMemo(() => {
    if (!user?.id) return null;
    return extensions.find((e: any) => Number(e.assigned_member_id) === Number(user.id)) || null;
  }, [extensions, user?.id]);

  const handleSelectExtension = useCallback(async (extId: string) => {
    setSelectedExtension(extId);
    setSipError('');

    if (sip.status !== 'idle') sip.disconnect();

    const ext = extensions.find((e: any) => String(e.id) === extId);
    if (!ext) return;

    if (!ext.api4com_ramal) {
      setSipError('Ramal sem vínculo Api4Com');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'get_sip_credentials', codAgent, extensionId: ext.id },
      });
      if (error) throw new Error(error.message || 'Erro ao buscar credenciais');
      if (data?.error) throw new Error(data.error);
      sip.connect(data.data);
    } catch (err: any) {
      setSipError(err.message || 'SIP indisponível');
    }
  }, [extensions, codAgent, sip]);

  // Auto-connect when dialog opens and extensions load
  useEffect(() => {
    if (!open) {
      autoConnected.current = false;
      return;
    }
    if (autoConnected.current || !myExtension || selectedExtension) return;
    autoConnected.current = true;
    handleSelectExtension(String(myExtension.id));
  }, [open, myExtension, selectedExtension, handleSelectExtension]);

  // Handle softphone call finished
  const handleCallFinished = useCallback(() => {
    setShowSoftphone(false);
  }, []);

  const dial = useMutation({
    mutationFn: async () => {
      const ext = extensions.find((e: any) => String(e.id) === selectedExtension);
      if (!ext) throw new Error('Nenhum ramal disponível');

      if (!(ext as any).api4com_ramal) {
        throw new Error('Ramal sem vínculo Api4Com. Sincronize os ramais.');
      }

      if (sip.status === 'registered') {
        sip.call(phoneInfo.formatted);
        return { via: 'sip' };
      }

      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'dial', codAgent, extensionId: ext.id, phone: phoneInfo.formatted },
      });
      if (error) throw new Error(error.message || 'Erro ao discar');
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (result) => {
      if (result?.via === 'sip') {
        toast.success(`Discando para ${contactName} via SIP...`);
        // Close dialog and show centered softphone
        onOpenChange(false);
        setShowSoftphone(true);
      } else {
        toast.success(`Ligando para ${contactName}...`);
        onOpenChange(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const hasExtension = !!myExtension;
  const sipStatusLabel = sip.status === 'registered' ? 'SIP ativo' : sip.status === 'error' ? 'SIP erro' : sip.status === 'idle' ? '' : sip.status;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hasExtension ? (
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

            {!hasExtension ? (
              <div className="text-center py-4 space-y-2">
                <PhoneOff className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Você não possui ramal ativo.</p>
                <p className="text-xs text-muted-foreground">Solicite ao administrador.</p>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                <div className="text-sm">
                  <span className="text-muted-foreground">Ramal: </span>
                  <span className="font-medium">
                    {myExtension.extension_number} {myExtension.label ? `(${myExtension.label})` : ''}
                  </span>
                </div>
                {(myExtension as any).api4com_ramal && (
                  <Badge variant="outline" className="text-[10px] h-5">
                    {(myExtension as any).api4com_ramal}
                  </Badge>
                )}
              </div>
            )}

            {sipError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {sipError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              onClick={() => dial.mutate()}
              disabled={!hasExtension || !selectedExtension || dial.isPending || sip.status === 'calling'}
              className="gap-2"
            >
              {dial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
              {dial.isPending ? 'Discando...' : sip.status === 'registered' ? 'Ligar (SIP)' : 'Ligar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Softphone rendered outside dialog, centered on screen */}
      {showSoftphone && (
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
          centered
          onCallFinished={handleCallFinished}
        />
      )}
    </>
  );
}
