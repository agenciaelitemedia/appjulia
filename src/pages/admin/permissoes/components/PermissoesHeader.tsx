import { Shield, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PermissoesHeaderProps {
  onEditDefaults: () => void;
}

export function PermissoesHeader({ onEditDefaults }: PermissoesHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Gerenciar Permissões</h1>
          <p className="text-sm text-muted-foreground">
            Configure as permissões de acesso dos usuários aos módulos do sistema
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={onEditDefaults}>
        <Settings className="w-4 h-4 mr-2" />
        Editar Padrões de Cargo
      </Button>
    </div>
  );
}
