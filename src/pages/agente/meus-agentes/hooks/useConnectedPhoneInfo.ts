import { useQuery } from '@tanstack/react-query';
import { UaZapiClient } from '@/lib/uazapi';
import { ConnectionStatus } from '../types';

interface PhoneInfo {
  phone: string | null;
  pushName: string | null;
  profilePictureUrl: string | null;
}

interface InstanceInfoResponse {
  profileName?: string;
  pushName?: string;
  wid?: string;
  owner?: string;
  phone?: string;
  profilePicUrl?: string;
  profilePictureUrl?: string;
  [key: string]: unknown;
}

export function useConnectedPhoneInfo(
  hub: string | null,
  evoUrl: string | null,
  evoApikey: string | null,
  connectionStatus: ConnectionStatus,
) {
  return useQuery<PhoneInfo>({
    queryKey: ['connected-phone-info', evoUrl, connectionStatus],
    queryFn: async () => {
      if (!evoUrl || !evoApikey) throw new Error('No credentials');

      const client = new UaZapiClient({
        baseUrl: evoUrl,
        token: evoApikey,
      });

      const data = await client.get<InstanceInfoResponse>('/instance/info');

      return {
        phone: data?.wid || data?.owner || data?.phone || null,
        pushName: data?.pushName || data?.profileName || null,
        profilePictureUrl: data?.profilePicUrl || data?.profilePictureUrl || null,
      };
    },
    enabled: hub === 'uazapi' && connectionStatus === 'connected' && !!evoUrl && !!evoApikey,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
