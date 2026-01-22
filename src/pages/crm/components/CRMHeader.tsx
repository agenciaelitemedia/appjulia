import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CRMHeaderProps {
  onRefresh: () => void;
  isLoading?: boolean;
}

export function CRMHeader({ onRefresh, isLoading }: CRMHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CRM Atende Julia</h1>
        <p className="text-muted-foreground">
          Gerencie leads e acompanhe o pipeline de atendimento
        </p>
      </div>
      <Button variant="outline" onClick={onRefresh} disabled={isLoading} className="gap-2">
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
        Atualizar
      </Button>
    </div>
  );
}
