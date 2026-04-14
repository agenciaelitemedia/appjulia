import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PhoneProvider } from '@/contexts/PhoneContext';
import juliaLogo from '@/assets/julia-logo.png';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';
import { AgentBlockedScreen } from './AgentBlockedScreen';

export function AdvLayout() {
  const { user, isAuthenticated, isLoading, isAdmin, logout } = useAuth();
  const { data: agentsData, isLoading: agentsLoading } = useMyAgents();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if non-admin user has all agents inactive
  if (!isAdmin && !agentsLoading && agentsData) {
    const allAgents = [...agentsData.myAgents, ...agentsData.monitoredAgents];
    if (allAgents.length > 0 && !allAgents.some(a => a.status === true)) {
      return <AgentBlockedScreen />;
    }
    if (allAgents.length === 0 && user?.cod_agent) {
      return <AgentBlockedScreen />;
    }
  }

  return (
    <PhoneProvider>
      <div className="min-h-[100dvh] flex flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <img src={juliaLogo} alt="Julia IA" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-foreground text-sm">JulIA</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground truncate max-w-[140px]">
              {user?.name}
            </span>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </PhoneProvider>
  );
}
