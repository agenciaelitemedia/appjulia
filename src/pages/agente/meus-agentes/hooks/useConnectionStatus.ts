import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionStatus, WhatsAppProvider } from '../types';

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

export function useConnectionStatus(
  hub: WhatsAppProvider,
  evoUrl: string | null,
  evoApikey: string | null,
  evoInstancia: string | null,
  wabaConfigured?: boolean,
  agentId?: number | null
) {
  return useQuery({
    queryKey: ['connection-status', hub, evoUrl, evoInstancia, agentId],
    queryFn: async (): Promise<ConnectionStatus> => {
      // Sem configuração
      if (!hub) return 'no_config';
      
      // WABA provider
      if (hub === 'waba') {
        if (!wabaConfigured || !agentId) return 'no_config';
        
        try {
          const { data, error } = await supabase.functions.invoke('waba-admin', {
            body: { action: 'verify_connection', agentId },
          });
          
          if (error || !data?.success) return 'disconnected';
          return data.connected ? 'waba_connected' : 'disconnected';
        } catch {
          return 'disconnected';
        }
      }
      
      // UaZapi provider
      if (hub === 'uazapi') {
        if (!evoUrl || !evoApikey) return 'no_config';
        
        try {
          const client = new UaZapiClient({
            baseUrl: evoUrl,
            token: evoApikey,
            instance: evoInstancia || undefined,
          });
          
          const response = await client.get<InstanceStatusResponse>('/instance/status');
          const isConnected = response.status?.connected === true && response.status?.loggedIn === true;
          return isConnected ? 'connected' : 'disconnected';
        } catch {
          return 'disconnected';
        }
      }
      
      return 'no_config';
    },
    enabled: !!hub && (
      (hub === 'uazapi' && !!evoUrl && !!evoApikey) ||
      (hub === 'waba' && !!wabaConfigured && !!agentId)
    ),
    staleTime: hub === 'waba' ? 120000 : 60000, // 2min WABA, 1min UaZapi
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
