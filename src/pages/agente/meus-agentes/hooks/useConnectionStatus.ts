import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionStatus, WhatsAppProvider, LinkedQueueInfo } from '../types';

interface InstanceStatusResponse {
  instance?: {
    status?: string;
    name?: string;
    profileName?: string;
  };
  status?: {
    connected?: boolean;
    loggedIn?: boolean;
    jid?: string;
  };
}

export interface ConnectionStatusResult {
  status: ConnectionStatus;
  linkedQueue?: LinkedQueueInfo | null;
}

async function checkLinkedQueue(codAgent: string): Promise<LinkedQueueInfo | null> {
  const { data, error } = await supabase
    .from('queue_agent_links')
    .select('queue_id, is_primary, queues(id, name, channel_type)')
    .eq('cod_agent', codAgent)
    .order('is_primary', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0] as any;
  if (!row.queues) return null;
  return {
    queue_id: row.queue_id,
    queue_name: row.queues.name,
    channel_type: row.queues.channel_type,
    is_primary: row.is_primary,
  };
}

export function useConnectionStatus(
  hub: WhatsAppProvider,
  evoUrl: string | null,
  evoApikey: string | null,
  evoInstancia: string | null,
  wabaConfigured?: boolean,
  agentId?: number | null,
  codAgent?: string,
) {
  return useQuery({
    queryKey: ['connection-status', hub, evoUrl, evoInstancia, agentId, codAgent],
    queryFn: async (): Promise<ConnectionStatusResult> => {
      // 1) Prioridade: vínculo com fila (modelo novo)
      if (codAgent) {
        const linked = await checkLinkedQueue(codAgent);
        if (linked) {
          return { status: 'queue_connected', linkedQueue: linked };
        }
      }

      // Sem configuração
      if (!hub) return { status: 'no_config' };

      // WABA provider (legado direto)
      if (hub === 'waba') {
        if (!wabaConfigured || !agentId) return { status: 'no_config' };
        try {
          const { data, error } = await supabase.functions.invoke('waba-admin', {
            body: { action: 'verify_connection', agentId },
          });
          if (error || !data?.success) return { status: 'disconnected' };
          return { status: data.connected ? 'waba_connected' : 'disconnected' };
        } catch {
          return { status: 'disconnected' };
        }
      }

      // UaZapi provider
      if (hub === 'uazapi') {
        if (!evoUrl || !evoApikey) return { status: 'no_config' };
        try {
          const client = new UaZapiClient({
            baseUrl: evoUrl,
            token: evoApikey,
            instance: evoInstancia || undefined,
          });
          const response = await client.get<InstanceStatusResponse>('/instance/status');
          const isConnected = response.status?.connected === true && response.status?.loggedIn === true;
          return { status: isConnected ? 'connected' : 'disconnected' };
        } catch {
          return { status: 'disconnected' };
        }
      }

      return { status: 'no_config' };
    },
    enabled: !!codAgent || !!hub,
    staleTime: hub === 'waba' ? 120000 : 60000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
