import { Bot, Eye, Loader2 } from 'lucide-react';
import { useMyAgents } from './hooks/useMyAgents';
import { AgentCard } from './components/AgentCard';

export default function MyAgentsPage() {
  const { data, isLoading, error } = useMyAgents();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">
        Erro ao carregar agentes: {error.message}
      </div>
    );
  }

  const { myAgents = [], monitoredAgents = [] } = data || {};

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Agentes</h1>
        <p className="text-muted-foreground">
          Gerencie os agentes vinculados à sua conta
        </p>
      </div>

      {/* Meus Agentes */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Meus Agentes</h2>
          <span className="text-sm text-muted-foreground">({myAgents.length})</span>
        </div>

        {myAgents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
            Nenhum agente vinculado à sua conta
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myAgents.map((agent) => (
              <AgentCard 
                key={`my-${agent.cod_agent}`} 
                agent={agent} 
              />
            ))}
          </div>
        )}
      </section>

      {/* Agentes Monitorados */}
      {monitoredAgents.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Agentes Monitorados</h2>
            <span className="text-sm text-muted-foreground">({monitoredAgents.length})</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monitoredAgents.map((agent) => (
              <AgentCard 
                key={`monitored-${agent.cod_agent}`} 
                agent={agent}
                isMonitored 
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
