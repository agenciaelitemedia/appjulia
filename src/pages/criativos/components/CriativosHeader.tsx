import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CriativosHeaderProps {
  onUpload: () => void;
}

export function CriativosHeader({ onUpload }: CriativosHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold">Criativos</h1>
        <p className="text-muted-foreground">
          Biblioteca de vídeos e imagens para suas campanhas
        </p>
      </div>

      <Button onClick={onUpload} className="gap-2">
        <Upload className="h-4 w-4" />
        Novo Criativo
      </Button>
    </div>
  );
}
