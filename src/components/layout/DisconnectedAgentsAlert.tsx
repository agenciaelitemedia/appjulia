import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';
import { UaZapiClient } from '@/lib/uazapi/client';
import { supabase } from '@/integrations/supabase/client';
import type { UserAgent } from '@/pages/agente/meus-agentes/types';

const LOGIN_FLAG = 'julia_just_logged_in';
export function markJustLoggedIn() {
  try {
    sessionStorage.setItem(LOGIN_FLAG, '1');
    sessionStorage.removeItem('julia_queues_alert_shown');
  } catch {}
}

async function checkAgentConnected(agent: UserAgent): Promise<boolean | null> {
  if (!agent.hub) return null; // sem config — ignora
  try {
    if (agent.hub === 'waba') {
      if (!agent.waba_configured || !agent.agent_id_from_agents) return null;
      const { data, error } = await supabase.functions.invoke('waba-admin', {
        body: { action: 'verify_connection', agentId: agent.agent_id_from_agents },
      });
      if (error || !data?.success) return false;
      return !!data.connected;
    }
    if (agent.hub === 'uazapi') {
      if (!agent.evo_url || !agent.evo_apikey) return null;
      const client = new UaZapiClient({
        baseUrl: agent.evo_url,
        token: agent.evo_apikey,
        instance: agent.evo_instancia || undefined,
      });
      const resp: any = await client.get('/instance/status');
      return resp?.status?.connected === true && resp?.status?.loggedIn === true;
    }
    return null;
  } catch {
    return false;
  }
}

export function DisconnectedAgentsAlert() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { data: agentsData } = useMyAgents();
  const [open, setOpen] = useState(false);
  const [disconnected, setDisconnected] = useState<UserAgent[]>([]);

  // Apenas agentes onde o usuário é owner (agent_id !== null) e ativos
  const allAgents: UserAgent[] = agentsData
    ? agentsData.myAgents.filter(a => a.status === true)
    : [];

  const queries = useQueries({
    queries: allAgents.map(agent => ({
      queryKey: ['login-conn-check', agent.cod_agent, agent.hub, agent.evo_instancia, agent.agent_id_from_agents],
      queryFn: async () => ({ agent, connected: await checkAgentConnected(agent) }),
      staleTime: 60_000,
      retry: 0,
      enabled: isAuthenticated && allAgents.length > 0,
    })),
  });

  const allDone = queries.length > 0 && queries.every(q => !q.isLoading);

  const handledRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user?.id || !allDone || handledRef.current) return;
    if (sessionStorage.getItem(LOGIN_FLAG) !== '1') return;

    const off = queries
      .map(q => q.data)
      .filter((d): d is { agent: UserAgent; connected: boolean | null } => !!d && d.connected === false)
      .map(d => d.agent);

    handledRef.current = true;
    sessionStorage.removeItem(LOGIN_FLAG);

    if (off.length > 0) {
      setDisconnected(off);
      setOpen(true);
    }
  }, [allDone, isAuthenticated, user?.id, queries]);

  if (disconnected.length === 0) return null;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            {disconnected.length === 1 ? 'Agente desconectado' : 'Agentes desconectados'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            {disconnected.length === 1
              ? 'Um dos seus agentes está desconectado do WhatsApp e não está atendendo no momento:'
              : `${disconnected.length} agentes estão desconectados do WhatsApp e não estão atendendo no momento:`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ul className="space-y-2 max-h-48 overflow-auto rounded-md border p-3 bg-muted/30">
          {disconnected.map(a => (
            <li key={a.cod_agent} className="text-sm">
              <span className="font-medium">#{a.cod_agent}</span>
              {a.business_name && <span className="text-muted-foreground"> — {a.business_name}</span>}
            </li>
          ))}
        </ul>

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              setOpen(false);
              if (user?.role !== 'advogado') navigate('/agente/meus-agentes');
            }}
          >
            Ver meus agentes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
