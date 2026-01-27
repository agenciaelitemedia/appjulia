import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { UaZapiClient } from '@/lib/uazapi/client';

interface InstanceStatusResponse {
  instance?: {
    qrcode?: string;
    profileName?: string;
    status?: string;
  };
  status?: {
    connected?: boolean;
    loggedIn?: boolean;
  };
}

interface QRCodePollingResult {
  qrCode: string | null;
  isConnected: boolean;
  profileName: string | null;
}

export function useQRCodePolling(
  evoUrl: string | null,
  evoApikey: string | null,
  enabled: boolean
) {
  const [countdown, setCountdown] = useState(10);

  // Countdown effect
  useEffect(() => {
    if (!enabled) {
      setCountdown(10);
      return;
    }

    const interval = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 10 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  const query = useQuery({
    queryKey: ['qr-code-polling', evoUrl],
    queryFn: async (): Promise<QRCodePollingResult> => {
      if (!evoUrl || !evoApikey) {
        throw new Error('Credenciais não configuradas');
      }

      const client = new UaZapiClient({
        baseUrl: evoUrl,
        token: evoApikey,
      });

      const response = await client.get<InstanceStatusResponse>('/instance/status');

      const isConnected = response.status?.connected === true && response.status?.loggedIn === true;

      return {
        qrCode: response.instance?.qrcode || null,
        isConnected,
        profileName: response.instance?.profileName || null,
      };
    },
    enabled: enabled && !!evoUrl && !!evoApikey,
    refetchInterval: 10000, // 10 segundos
    staleTime: 0,
    retry: 1,
  });

  return {
    ...query,
    countdown,
  };
}
