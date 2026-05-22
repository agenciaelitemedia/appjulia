import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { forceDownload } from '@/lib/forceDownload';

interface MediaLightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  caption?: string | null;
  fileName?: string | null;
}

export function MediaLightbox({ open, onOpenChange, url, caption, fileName }: MediaLightboxProps) {
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!open) setZoom(1);
  }, [open]);

  if (!url) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-background/95 border-0 flex flex-col">
        {/* Toolbar */}
        <div className="absolute top-3 right-3 z-50 flex gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full shadow-lg"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            aria-label="Reduzir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full shadow-lg"
            onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full shadow-lg"
            aria-label="Baixar"
            onClick={() => forceDownload(url, fileName)}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full shadow-lg"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Image */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6">
          <img
            src={url}
            alt={caption || 'Mídia'}
            style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
            className="max-w-full max-h-full object-contain select-none"
            draggable={false}
          />
        </div>

        {caption && (
          <div className="px-6 py-3 text-center text-sm text-muted-foreground bg-background/80 backdrop-blur">
            {caption}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
