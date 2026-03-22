import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, ChevronDown, Activity, PhoneForwarded } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { useSipPhone } from '../hooks/useSipPhone';
import { SoftphoneWidget } from './SoftphoneWidget';
import { DiscadorPad } from './DiscadorPad';
import { toast } from 'sonner';
import { formatPhoneForDialing } from '@/lib/phoneFormat';

interface Props {
  codAgent: string;
}

const statusColors: Record<string, string> = {
  idle: 'bg-muted text-muted-foreground',
  registering: 'bg-yellow-500/10 text-yellow-600',
  registered: 'bg-green-500/10 text-green-600',
  calling: 'bg-blue-500/10 text-blue-600',
  ringing: 'bg-orange-500/10 text-orange-600',
  'in-call': 'bg-green-500/10 text-green-600',
  error: 'bg-destructive/10 text-destructive',
};

export function DiscadorTab({ codAgent }: Props) {
  const { extensions, dial, getSipCredentials } = useTelefoniaData(codAgent);
  const sip = useSipPhone();
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [number, setNumber] = useState('');
  const [sipError, setSipError] = useState('');

  const activeExtensions = extensions.filter((e) => e.is_active);

  const handleSelectExtension = useCallback(async (extId: string) => {
    setSelectedExtension(extId);
    setSipError('');

    if (sip.status !== 'idle') {
      sip.disconnect();
    }

    const ext = extensions.find((e) => String(e.id) === extId);
    if (!ext) return;

    if (!ext.api4com_ramal) {
      setSipError('Ramal sem vínculo Api4Com. Sincronize os ramais primeiro.');
      return;
    }

    try {
      const creds = await getSipCredentials(ext.id);
      sip.connect(creds);
    } catch (err: any) {
      setSipError(err.message || 'Erro ao conectar SIP');
      toast.warning('SIP indisponível, usando discagem via API');
    }
  }, [extensions, getSipCredentials, sip]);

  const phoneInfo = useMemo(() => {
    if (!number || number.replace(/\D/g, '').length < 8) return null;
    return formatPhoneForDialing(number);
  }, [number]);

  const handleDial = useCallback(() => {
    if (!selectedExtension || !number) return;

    const ext = extensions.find((e) => String(e.id) === selectedExtension);
    if (!ext) return;

    if (!ext.api4com_ramal) {
      toast.error('Ramal sem vínculo Api4Com. Sincronize os ramais.');
      return;
    }

    const { formatted } = formatPhoneForDialing(number);

    if (sip.status === 'registered') {
      sip.call(formatted);
    } else {
      dial.mutate({ extensionId: ext.id, phone: formatted });
    }
  }, [selectedExtension, number, sip, extensions, dial]);

  return (
    <div className="max-w-md mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg text-center flex items-center justify-center gap-2">
            Discador
            {sip.status !== 'idle' && (
              <Badge variant="secondary" className={statusColors[sip.status]}>
                {sip.status === 'registered' ? 'SIP Conectado' : sip.status === 'error' ? 'SIP Erro' : sip.status}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">Ramal de origem</label>
            <Select value={selectedExtension} onValueChange={handleSelectExtension}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ramal..." />
              </SelectTrigger>
              <SelectContent>
                {activeExtensions.map((ext) => (
                  <SelectItem key={ext.id} value={String(ext.id)}>
                    {ext.extension_number} {ext.label ? `(${ext.label})` : ''}
                    {ext.api4com_ramal ? ` → ${ext.api4com_ramal}` : ' ⚠️ sem vínculo'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sipError && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> {sipError}
              </p>
            )}
          </div>

          <DiscadorPad
            value={number}
            onChange={setNumber}
            onDial={handleDial}
            disabled={!selectedExtension || dial.isPending || sip.status === 'calling'}
            isDialing={dial.isPending || sip.status === 'calling'}
          />

          {/* SIP Diagnostics Panel */}
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center pt-2">
              <Activity className="h-3 w-3" />
              Diagnóstico SIP
              <ChevronDown className="h-3 w-3" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-2 text-xs font-mono">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-muted-foreground">Domínio:</span>
                  <span className="truncate">{sip.diagnostics.domain || '—'}</span>
                  <span className="text-muted-foreground">WebSocket:</span>
                  <span className="truncate">{sip.diagnostics.wsUrl || '—'}</span>
                  <span className="text-muted-foreground">Usuário:</span>
                  <span>{sip.diagnostics.username || '—'}</span>
                  <span className="text-muted-foreground">WS Estado:</span>
                  <Badge variant="outline" className="w-fit text-[10px] h-5">
                    {sip.diagnostics.wsState}
                  </Badge>
                  <span className="text-muted-foreground">Registro:</span>
                  <Badge
                    variant="outline"
                    className={`w-fit text-[10px] h-5 ${
                      sip.diagnostics.registrationStatus === 'registered'
                        ? 'border-green-500 text-green-600'
                        : sip.diagnostics.registrationStatus === 'error'
                        ? 'border-destructive text-destructive'
                        : ''
                    }`}
                  >
                    {sip.diagnostics.registrationStatus}
                  </Badge>
                </div>
                {sip.diagnostics.lastError && (
                  <p className="text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {sip.diagnostics.lastError}
                  </p>
                )}
                {sip.diagnostics.events.length > 0 && (
                  <div className="border-t pt-2 mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                    <p className="text-muted-foreground mb-1">Eventos:</p>
                    {sip.diagnostics.events.map((e, i) => (
                      <p key={i} className="text-[10px] leading-tight text-muted-foreground">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      <SoftphoneWidget
        status={sip.status}
        duration={sip.duration}
        isMuted={sip.isMuted}
        isHeld={sip.isHeld}
        callerInfo={sip.callerInfo}
        onAnswer={sip.answer}
        onHangup={sip.hangup}
        onToggleMute={sip.toggleMute}
        onToggleHold={sip.toggleHold}
        onSendDTMF={sip.sendDTMF}
      />
    </div>
  );
}
