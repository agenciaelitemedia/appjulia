import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateAgentWizard } from './components/CreateAgentWizard';

export default function CreateAgentPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/admin/agentes">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Agente</h1>
            <p className="text-sm text-muted-foreground">
              Preencha as informações para cadastrar um novo agente IA
            </p>
          </div>
        </div>
      </div>

      {/* Wizard */}
      <CreateAgentWizard />
    </div>
  );
}
