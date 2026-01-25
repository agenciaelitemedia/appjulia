import { Video, Calendar, User, FolderOpen, Share2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { CreativeFile } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CreativePreviewDialogProps {
  file: CreativeFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreativePreviewDialog({ file, open, onOpenChange }: CreativePreviewDialogProps) {
  if (!file) return null;

  const mediaUrl = file.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{file.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media Preview */}
          <div className="bg-muted rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
            {file.type_file === 'video' ? (
              <video 
                src={mediaUrl} 
                controls 
                className="max-w-full max-h-[500px]"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent) {
                    parent.innerHTML = '<div class="flex flex-col items-center justify-center p-8 text-muted-foreground"><svg class="h-16 w-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg><span>Vídeo não disponível</span></div>';
                  }
                }}
              />
            ) : (
              <img 
                src={mediaUrl} 
                alt={file.title}
                className="max-w-full max-h-[500px] object-contain"
                onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
              />
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Criado em: {format(new Date(file.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
            </div>

            {file.user_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Por: {file.user_name}</span>
              </div>
            )}

            {file.category_name && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FolderOpen className="h-4 w-4" />
                <span>Categoria: {file.category_name}</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {file.shared ? (
                <Badge variant="secondary" className="gap-1">
                  <Share2 className="h-3 w-3" />
                  Compartilhado
                </Badge>
              ) : (
                <Badge variant="outline">Privado</Badge>
              )}
              
              <Badge variant="outline" className="uppercase">
                {file.type_file === 'video' ? (
                  <><Video className="h-3 w-3 mr-1" /> Vídeo</>
                ) : (
                  'Imagem'
                )}
              </Badge>
            </div>
          </div>

          {/* Description */}
          {file.description && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground">{file.description}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
