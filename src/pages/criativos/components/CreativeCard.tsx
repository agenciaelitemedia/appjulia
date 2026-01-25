import { useState } from 'react';
import { Eye, Pencil, Trash2, Video, Share2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreativeFile } from '../types';
import { useDeleteCreative } from '../hooks/useCriativosData';
import { CreativeEditDialog } from './CreativeEditDialog';

interface CreativeCardProps {
  file: CreativeFile;
  onPreview: () => void;
  showOwner: boolean;
  canEdit: boolean;
}

export function CreativeCard({ file, onPreview, showOwner, canEdit }: CreativeCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const deleteMutation = useDeleteCreative();

  // The 'name' field now contains the full URL from Supabase Storage
  const mediaUrl = file.name;

  return (
    <Card className="overflow-hidden group cursor-pointer hover:shadow-md transition-shadow">
      {/* Thumbnail */}
      <div 
        className="aspect-square relative bg-muted"
        onClick={onPreview}
      >
        {file.type_file === 'video' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
            <video 
              src={mediaUrl}
              className="w-full h-full object-cover"
              muted
              preload="metadata"
              onError={(e) => { 
                e.currentTarget.style.display = 'none';
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Video className="h-12 w-12 text-white/80 drop-shadow-lg" />
            </div>
            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
              VIDEO
            </div>
          </div>
        ) : (
          <img 
            src={mediaUrl}
            alt={file.title}
            className="w-full h-full object-cover"
            onError={(e) => { e.currentTarget.src = '/placeholder.svg' }}
          />
        )}

        {/* Overlay com ações */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="icon" variant="secondary">
            <Eye className="h-4 w-4" />
          </Button>
          {canEdit && (
            <>
              <Button 
                size="icon" 
                variant="secondary"
                onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button 
                size="icon" 
                variant="destructive"
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (confirm('Excluir este criativo?')) {
                    deleteMutation.mutate(file.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Info */}
      <CardContent className="p-3">
        <h4 className="font-medium text-sm truncate">{file.title}</h4>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {file.category_name && (
            <Badge variant="secondary" className="text-xs">
              {file.category_name}
            </Badge>
          )}
          {file.shared && (
            <Badge variant="outline" className="text-xs">
              <Share2 className="h-3 w-3 mr-1" />
              Compartilhado
            </Badge>
          )}
        </div>
        {showOwner && file.user_name && (
          <p className="text-xs text-muted-foreground mt-1">
            Por: {file.user_name}
          </p>
        )}
      </CardContent>

      {canEdit && (
        <CreativeEditDialog 
          file={file}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
    </Card>
  );
}
