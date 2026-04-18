import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const META_APP_ID = import.meta.env.VITE_META_APP_ID ?? '';
const META_CONFIG_ID = import.meta.env.VITE_META_CONFIG_ID ?? '';

export interface WabaSignupResult {
  accessToken: string;
  wabaBusinessId: string;
  phoneNumberId: string;
}

interface Props {
  onSuccess: (result: WabaSignupResult) => void;
  label?: string;
  variant?: 'default' | 'outline';
  className?: string;
  disabled?: boolean;
}

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

const loadFacebookSDK = (): Promise<void> =>
  new Promise((resolve) => {
    if (window.FB) { resolve(); return; }
    window.fbAsyncInit = () => {
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: true, version: 'v22.0' });
      resolve();
    };
    if (!document.getElementById('facebook-jssdk')) {
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/pt_BR/sdk.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });

export function WabaEmbeddedSignupButton({
  onSuccess,
  label = 'Conectar via Meta',
  variant = 'default',
  className,
  disabled,
}: Props) {
  const [busy, setBusy] = useState(false);

  const launch = () => {
    setBusy(true);
    let signupInfo = { waba_id: '', phone_number_id: '' };
    let resolveSignup: ((v: { waba_id: string; phone_number_id: string }) => void) | null = null;
    const signupPromise = new Promise<{ waba_id: string; phone_number_id: string }>((r) => { resolveSignup = r; });

    const listener = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com') return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          if (data.event === 'FINISH') {
            signupInfo = {
              waba_id: data.data?.waba_id || '',
              phone_number_id: data.data?.phone_number_id || '',
            };
            resolveSignup?.(signupInfo);
          }
          if (data.event === 'CANCEL' || data.event === 'ERROR') {
            resolveSignup?.({ waba_id: '', phone_number_id: '' });
          }
        }
      } catch { /* ignore */ }
    };

    window.addEventListener('message', listener);

    window.FB.login(
      (response: any) => {
        if (!response.authResponse?.code) {
          window.removeEventListener('message', listener);
          setBusy(false);
          toast.error('Login cancelado');
          return;
        }
        const code = response.authResponse.code;
        const timeout = new Promise<{ waba_id: string; phone_number_id: string }>((r) =>
          setTimeout(() => r(signupInfo), 5000)
        );
        Promise.race([signupPromise, timeout]).then(async (info) => {
          window.removeEventListener('message', listener);
          try {
            const { data: tokenData, error: tokenErr } = await supabase.functions.invoke('waba-admin', {
              body: { action: 'exchange_token', code },
            });
            if (tokenErr || !tokenData?.success) {
              throw new Error(tokenData?.error || tokenErr?.message || 'Falha ao trocar token');
            }
            let wabaBusinessId = info.waba_id;
            let phoneNumberId = info.phone_number_id;
            if (!wabaBusinessId || !phoneNumberId) {
              const { data: wabaInfo } = await supabase.functions.invoke('waba-admin', {
                body: { action: 'fetch_waba_info', accessToken: tokenData.access_token },
              });
              if (wabaInfo?.waba_id) wabaBusinessId = wabaInfo.waba_id;
              if (wabaInfo?.phone_number_id) phoneNumberId = wabaInfo.phone_number_id;
            }
            if (!wabaBusinessId) throw new Error('Não foi possível obter o WABA ID');
            onSuccess({ accessToken: tokenData.access_token, wabaBusinessId, phoneNumberId });
            toast.success('Conta Meta conectada');
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Erro desconhecido';
            toast.error(msg);
          } finally {
            setBusy(false);
          }
        });
      },
      {
        config_id: META_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { sessionInfoVersion: 3, featureType: 'whatsapp_business_app_onboarding' },
      }
    );
  };

  const handleClick = async () => {
    if (!META_APP_ID || !META_CONFIG_ID) {
      toast.error('Embedded Signup não configurado (VITE_META_APP_ID/VITE_META_CONFIG_ID)');
      return;
    }
    if (!window.FB) {
      setBusy(true);
      await loadFacebookSDK();
    }
    launch();
  };

  return (
    <Button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      variant={variant}
      className={className ?? 'w-full bg-[#1877F2] hover:bg-[#166FE5] text-white'}
    >
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
      {busy ? 'Conectando...' : label}
    </Button>
  );
}
