import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';
import { ConnectionStatus } from '../types';

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
  hub: string | null,
  evoUrl: string | null,
  evoApikey: string | null,
  evoInstancia: string | null
) {
  return useQuery({
    queryKey: ['connection-status', evoUrl, evoInstancia],
    queryFn: async (): Promise<ConnectionStatus> => {
      // Sem configuração
      if (!hub || !evoUrl || !evoApikey) {
        return 'no_config';
      }
      
      // Apenas suporta uazapi por enquanto
      if (hub !== 'uazapi') {
        return 'no_config';
      }
      
      try {
        const client = new UaZapiClient({
          baseUrl: evoUrl,
          token: evoApikey,
          instance: evoInstancia || undefined,
        });
        
        const response = await client.get<InstanceStatusResponse>('/instance/status');
        
        // Verificar status.connected e status.loggedIn (booleanos reais)
        const isConnected = response.status?.connected === true && response.status?.loggedIn === true;
        
        if (isConnected) {
          return 'connected';
        }
        
        return 'disconnected';
      } catch {
        return 'disconnected';
      }
    },
    enabled: !!hub && hub === 'uazapi' && !!evoUrl && !!evoApikey,
    staleTime: 60000, // Cache por 1 minuto
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
