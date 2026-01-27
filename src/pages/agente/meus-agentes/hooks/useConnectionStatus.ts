import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi/client';
import { ConnectionStatus } from '../types';

interface InstanceStatusResponse {
  status?: string;
  state?: string;
  instance?: {
    state?: string;
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
        
        // Verificar diferentes formatos de resposta da API
        const status = response.status || response.state || response.instance?.state;
        
        if (status === 'connected' || status === 'open') {
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
