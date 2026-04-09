import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi';
import { ConnectionStatus } from '../types';

interface PhoneInfo {
  phone: string | null;
  pushName: string | null;
  profilePictureUrl: string | null;
}

interface InstanceInfoResponse {
  status?: string;
  phone?: string;
  pushName?: string;
  profileName?: string;
  owner?: string;
  wid?: string;
  profilePicUrl?: string;
  profilePictureUrl?: string;
  instance?: {
    profileName?: string;
    name?: string;
    profilePicUrl?: string;
    owner?: string;
  };
  status_obj?: {
    jid?: string;
  };
}

export function useConnectedPhoneInfo(
  hub: string | null,
  evoUrl: string | null,
  evoApikey: string | null,
  evoInstancia: string | null,
  connectionStatus: ConnectionStatus,
) {
  return useQuery<PhoneInfo>({
    queryKey: ['connected-phone-info', evoUrl, evoInstancia, connectionStatus],
    queryFn: async () => {
      if (!evoUrl || !evoApikey) throw new Error('No credentials');

      const client = new UaZapiClient({
        baseUrl: evoUrl,
        token: evoApikey,
        instance: evoInstancia || undefined,
      });

      let data: InstanceInfoResponse | null = null;

      try {
        data = await client.get<InstanceInfoResponse>('/instance/info');
      } catch {
        data = await client.get<InstanceInfoResponse>('/instance/status');
      }

      return {
        phone: data?.phone || data?.wid || data?.owner || null,
        pushName: data?.pushName || data?.profileName || data?.instance?.profileName || data?.instance?.name || null,
        profilePictureUrl: data?.profilePicUrl || data?.profilePictureUrl || null,
      };
    },
    enabled: hub === 'uazapi' && connectionStatus === 'connected' && !!evoUrl && !!evoApikey,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
