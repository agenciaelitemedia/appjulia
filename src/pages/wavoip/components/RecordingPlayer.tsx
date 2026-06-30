import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Play, Download, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  callId: string;
  whatsappCallId: string | null;
  recordingPath: string | null;
  status: string;
  onRefetched?: () => void;
}

export function RecordingPlayer({ callId, whatsappCallId, recordingPath, status, onRefetched }: Props) {
  const [open, setOpen] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadSignedUrl = async () => {
    if (!recordingPath) return;
    const { data, error } = await supabase.storage.from('wavoip-recordings').createSignedUrl(recordingPath, 60 * 60);
    if (error) { toast.error(error.message); return; }
    setSignedUrl(data.signedUrl);
  };

  const fetchFromWavoip = async () => {
    if (!whatsappCallId) { toast.error('Sem ID da chamada na Wavoip'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('wavoip-fetch-recording', {
        body: { call_log_id: callId, whatsapp_call_id: whatsappCallId },
      });
      if (error) throw error;
      if ((data as any)?.status === 'available') toast.success('Gravação importada');
      else toast.message('Gravação ainda não disponível. Tente novamente em alguns minutos.');
      onRefetched?.();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar gravação');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'available' && recordingPath) {
    return (
      <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o && !signedUrl) void loadSignedUrl(); }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" title="Ouvir gravação" className="text-emerald-600 hover:text-emerald-700">
            <Play className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Gravação Wavoip</div>
            {signedUrl ? (
              <>
                <audio src={signedUrl} controls className="w-full" />
                <a href={signedUrl} download className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <Download className="h-3 w-3" /> Baixar
                </a>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm"><RefreshCw className="h-3 w-3 animate-spin" /> Carregando…</div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  if (!whatsappCallId) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const icon = status === 'error'
    ? <AlertCircle className="h-4 w-4 text-destructive" />
    : <Clock className="h-4 w-4 text-muted-foreground" />;

  return (
    <Button
      variant="ghost"
      size="icon"
      title={status === 'error' ? 'Erro ao baixar — tentar novamente' : 'Buscar gravação na Wavoip'}
      onClick={fetchFromWavoip}
      disabled={busy}
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : icon}
    </Button>
  );
}