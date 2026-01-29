import { Download, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecordingLink } from '../hooks/useRecordingLink';
import { toast } from 'sonner';

interface RecordingDownloadButtonProps {
  recordingId: string;
  status: string | null;
}

export function RecordingDownloadButton({ recordingId, status }: RecordingDownloadButtonProps) {
  const { mutate: getLink, isPending } = useRecordingLink();

  const handleDownload = () => {
    getLink(recordingId, {
      onSuccess: (data) => {
        if (data.downloadLink) {
          window.open(data.downloadLink, '_blank');
        }
      },
      onError: () => {
        toast.error('Gravação ainda em processamento. Tente novamente em alguns minutos.');
      },
    });
  };

  if (status === 'recording') {
    return (
      <Badge variant="secondary" className="bg-destructive/20 text-destructive border-destructive/30">
        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse mr-1" />
        Gravando
      </Badge>
    );
  }

  if (status === 'processing') {
    return (
      <Badge variant="secondary" className="bg-warning/20 text-warning-foreground border-warning/30">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Processando
      </Badge>
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

  return (
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
  );
}
