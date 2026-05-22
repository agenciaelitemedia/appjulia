import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2 } from 'lucide-react';
import type { MessageType } from '@/types/chat';

interface MediaPreviewDialogProps {
  file: File;
  type: MessageType;
  initialCaption?: string;
  sending?: boolean;
  onConfirm: (caption: string) => void;
  onCancel: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPreviewDialog({ file, type, initialCaption = '', sending = false, onConfirm, onCancel }: MediaPreviewDialogProps) {
  const [caption, setCaption] = useState(initialCaption);
  const objectUrl = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(objectUrl), [objectUrl]);

  const handleConfirm = () => {
    if (sending) return;
    onConfirm(caption.trim());
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !sending) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar {type === 'image' ? 'imagem' : type === 'video' ? 'vídeo' : 'arquivo'}</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center bg-muted/40 rounded-md p-3 min-h-[180px] max-h-[420px] overflow-hidden">
          {type === 'image' ? (
            <img src={objectUrl} alt={file.name} className="max-h-[400px] max-w-full object-contain rounded" />
          ) : type === 'video' ? (
            <video src={objectUrl} controls className="max-h-[400px] max-w-full rounded" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground py-8">
              <FileText className="h-12 w-12" />
              <span className="text-sm font-medium text-foreground break-all text-center px-4">{file.name}</span>
              <span className="text-xs">{formatBytes(file.size)}</span>
            </div>
          )}
        </div>

        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Adicione uma legenda (opcional)"
          className="min-h-[60px]"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleConfirm();
            }
          }}
          autoFocus
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={sending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {sending ? 'Enviando…' : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
