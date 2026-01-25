import { ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CreativeFile } from '../types';
import { CreativeCard } from './CreativeCard';

interface CriativosGridProps {
  files: CreativeFile[];
  isLoading: boolean;
  onPreview: (file: CreativeFile) => void;
  showOwner: boolean;
  canEdit: boolean;
}

export function CriativosGrid({ 
  files, 
  isLoading, 
  onPreview, 
  showOwner,
  canEdit 
}: CriativosGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-lg" />
        ))}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">Nenhum criativo encontrado</h3>
        <p className="text-muted-foreground">
          Ajuste os filtros ou adicione novos criativos
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {files.map(file => (
        <CreativeCard 
          key={file.id}
          file={file}
          onPreview={() => onPreview(file)}
          showOwner={showOwner}
          canEdit={canEdit}
        />
      ))}
    </div>
  );
}
