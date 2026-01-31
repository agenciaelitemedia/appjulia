import { useState, useEffect } from 'react';
import { Download, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useRecordingLink } from '../hooks/useRecordingLink';
import { toast } from 'sonner';

interface RecordingDownloadButtonProps {
  recordingId: string;
  status: string | null;
  recordingUrl?: string | null;
}

export function RecordingDownloadButton({ 
  recordingId, 
  status,
  recordingUrl 
}: RecordingDownloadButtonProps) {
  const { mutate: getLink, mutateAsync: getLinkAsync, isPending } = useRecordingLink();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(recordingUrl || null);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(status === 'ready' || !!recordingUrl);

  // Auto-check recording status when processing
  useEffect(() => {
    // If already ready or has URL, skip
    if (isReady || downloadUrl) return;
    // Only poll when status is 'processing'
    if (status !== 'processing') return;
    
    const checkRecording = async () => {
      try {
        const response = await getLinkAsync(recordingId);
        if (response?.downloadLink) {
          setDownloadUrl(response.downloadLink);
          setIsReady(true);
        }
      } catch {
        // Still processing, ignore
      }
    };

    // First check after 30 seconds, then every 30 seconds
    const timeout = setTimeout(checkRecording, 30000);
    const interval = setInterval(checkRecording, 30000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [status, recordingId, downloadUrl, isReady, getLinkAsync]);

  // Handler for manual check when clicking on "Processando"
  const handleCheckRecording = () => {
    getLink(recordingId, {
      onSuccess: (data) => {
        if (data.downloadLink) {
          setDownloadUrl(data.downloadLink);
          setIsReady(true);
          toast.success('Gravação pronta para download!');
        }
      },
      onError: () => {
        toast.info('Ainda processando. Tente novamente em alguns minutos.');
      },
    });
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
      return;
    }

    getLink(recordingId, {
      onSuccess: (data) => {
        if (data.downloadLink) {
          setDownloadUrl(data.downloadLink);
          setIsReady(true);
          window.open(data.downloadLink, '_blank');
        }
      },
      onError: () => {
        toast.error('Gravação ainda em processamento. Tente novamente em alguns minutos.');
      },
    });
  };

  const handleCopyLink = async () => {
    if (!downloadUrl) {
      getLink(recordingId, {
        onSuccess: async (data) => {
          if (data.downloadLink) {
            setDownloadUrl(data.downloadLink);
            setIsReady(true);
            await navigator.clipboard.writeText(data.downloadLink);
            setCopied(true);
            toast.success('Link copiado para a área de transferência!');
            setTimeout(() => setCopied(false), 2000);
          }
        },
        onError: () => {
          toast.error('Gravação ainda em processamento.');
        },
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(downloadUrl);
      setCopied(true);
      toast.success('Link copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar o link.');
    }
  };

  if (status === 'recording') {
    return (
      <Badge variant="secondary" className="bg-destructive/20 text-destructive border-destructive/30">
        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse mr-1" />
        Gravando
      </Badge>
    );
  }

  // Clickable processing state with polling
  if (status === 'processing' && !isReady) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleCheckRecording}
              disabled={isPending}
              className="h-8 px-2"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processando
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clique para verificar se a gravação está pronta</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (status === 'error' || status === 'none') {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <AlertCircle className="h-3 w-3 mr-1" />
        Indisponível
      </Badge>
    );
  }

  // status === 'ready' or isReady or downloadUrl exists
  return (
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleDownload}
              disabled={isPending}
              className="h-8 px-2"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Baixar gravação</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleCopyLink}
              disabled={isPending}
              className="h-8 px-2"
            >
              {copied ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copiar link da gravação</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
