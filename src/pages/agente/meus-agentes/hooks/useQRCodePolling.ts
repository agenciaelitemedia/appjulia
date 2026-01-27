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

      // Se não tem QR Code e não está conectado, tentar iniciar conexão
      if (!response.instance?.qrcode && !response.status?.connected) {
        try {
          await client.post('/instance/connect');
          // Buscar status novamente após connect
          const newResponse = await client.get<InstanceStatusResponse>('/instance/status');
          return {
            qrCode: newResponse.instance?.qrcode || null,
            isConnected: newResponse.status?.connected === true && newResponse.status?.loggedIn === true,
            profileName: newResponse.instance?.profileName || null,
          };
        } catch {
          // Ignorar erro - connect pode falhar se já estiver em progresso
        }
      }

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
