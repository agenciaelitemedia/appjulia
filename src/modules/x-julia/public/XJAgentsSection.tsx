/**
 * Superfície pública do módulo X-Julia para a página "Meus Agentes".
 * Único ponto que o restante do app importa do módulo.
 */
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useXJAgents } from '../hooks/useXJAgents';
import { X_JULIA_ROUTES } from '../module';

export function useXJAgentsCount() {
  const { data = [] } = useXJAgents();
  return data.length;
}

export function XJAgentsSection() {
  const { data: agents = [], isLoading } = useXJAgents();

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground">
        Nenhum agente X-Julia criado para este escritório
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {agents.map((agent) => (
        <Card key={agent.id} className="transition-colors hover:border-primary/40">
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.llm_model}</p>
                </div>
              </div>
              <Badge variant={agent.is_active ? 'default' : 'outline'}>
                {agent.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">X-Julia</Badge>
              {agent.voice_enabled && <Badge variant="outline" className="text-[10px]">Áudio</Badge>}
              <Badge variant="outline" className="text-[10px]">{agent.contract_provider}</Badge>
            </div>
            <Link to={X_JULIA_ROUTES.agent(agent.id)} className="block text-sm text-primary hover:underline">
              Gerenciar agente
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}