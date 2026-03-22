import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { useSipPhone } from '../hooks/useSipPhone';
import { SoftphoneWidget } from './SoftphoneWidget';
import { DiscadorPad } from './DiscadorPad';
import { toast } from 'sonner';

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

  const activeExtensions = extensions.filter((e) => e.is_active);

  const handleSelectExtension = useCallback(async (extId: string) => {
    setSelectedExtension(extId);

    // Disconnect previous SIP if any
    if (sip.status !== 'idle') {
      sip.disconnect();
    }

    // Try to connect SIP
    const ext = extensions.find((e) => String(e.id) === extId);
    if (!ext) return;

    try {
      const creds = await getSipCredentials(ext.id);
      sip.connect(creds);
    } catch {
      // SIP not available, will use REST fallback
      toast.info('SIP não disponível, usando discagem via API');
    }
  }, [extensions, getSipCredentials, sip]);

  const handleDial = useCallback(() => {
    if (!selectedExtension || !number) return;

    if (sip.status === 'registered') {
      // Use SIP
      sip.call(number);
    } else {
      // REST fallback
      const ext = extensions.find((e) => String(e.id) === selectedExtension);
      const extensionNumber = ext?.api4com_ramal || ext?.extension_number || '';
      dial.mutate({ extension: extensionNumber, phone: number });
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
                {sip.status === 'registered' ? 'SIP' : sip.status}
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
                    {ext.api4com_ramal ? ` → ${ext.api4com_ramal}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DiscadorPad
            value={number}
            onChange={setNumber}
            onDial={handleDial}
            disabled={!selectedExtension || dial.isPending || sip.status === 'calling'}
            isDialing={dial.isPending || sip.status === 'calling'}
          />
        </CardContent>
      </Card>

      {/* Softphone Widget */}
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
