import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import juliaLogo from '@/assets/julia-logo.png';

export function AgentBlockedScreen() {
  const { logout } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <img src={juliaLogo} alt="Julia IA" className="w-16 h-16 rounded-2xl" />
        </div>

        <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Agente Bloqueado</h1>
          <p className="text-muted-foreground leading-relaxed">
            Seu agente está inativo no momento. Entre em contato com o administrador do sistema para maiores informações.
          </p>
        </div>

        <Button variant="outline" onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </div>
  );
}
