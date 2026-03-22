import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface GravacaoPlayerProps {
  url: string;
  onClose: () => void;
}

export function GravacaoPlayer({ url, onClose }: GravacaoPlayerProps) {
  return (
    <Card className="border-primary/30">
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Gravação</p>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <audio controls className="w-full" src={url} autoPlay>
          Seu navegador não suporta o elemento de áudio.
        </audio>
      </CardContent>
    </Card>
  );
}
