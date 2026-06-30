import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

type WavoipApi = any;

interface WavoipContextValue {
  ready: boolean;
  hasActivePlan: boolean;
  devicesCount: number;
  startCall: (phoneE164: string, displayName?: string) => Promise<{ ok: boolean; error?: string }>;
  openWidget: () => void;
  refreshDevices: () => Promise<void>;
}

const WavoipContext = createContext<WavoipContextValue | undefined>(undefined);

async function loadWebphone(): Promise<any> {
  const mod = await import('@wavoip/wavoip-webphone');
  return (mod as any).default ?? mod;
}

export function WavoipProvider({ children }: { children: ReactNode }) {
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [devicesCount, setDevicesCount] = useState(0);
  const [ready, setReady] = useState(false);
  const apiRef = useRef<WavoipApi | null>(null);

  // Resolve current auth user
  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setAuthUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const loadPlanAndDevices = useCallback(async (): Promise<string[]> => {
    if (!authUserId) {
      setHasActivePlan(false);
      setDevicesCount(0);
      return [];
    }
    const { data: plans } = await (supabase as any)
      .from('wavoip_user_plans')
      .select('id,status')
      .eq('user_id', authUserId)
      .eq('status', 'active');
    const active = (plans ?? []).length > 0;
    setHasActivePlan(active);
    if (!active) {
      setDevicesCount(0);
      return [];
    }
    const { data: devs } = await (supabase as any)
      .from('wavoip_devices')
      .select('device_token,status')
      .eq('user_id', authUserId);
    const tokens = (devs ?? []).map((d: any) => d.device_token).filter(Boolean);
    setDevicesCount(tokens.length);
    return tokens;
  }, [authUserId]);

  // Mount webphone when plan is active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const tokens = await loadPlanAndDevices();
      if (cancelled || !hasActivePlan) return;
      try {
        const webphone = await loadWebphone();
        const api = await webphone.render({
          theme: 'system',
          buttonPosition: 'bottom-right',
          position: 'bottom-right',
          widget: { startOpen: false, showWidgetButton: true },
          callSettings: { displayName: 'Atendimento' },
          platform: 'atende-julia',
        });
        apiRef.current = api ?? (window as any).wavoip;
        // Inject persisted device tokens
        for (const t of tokens) {
          try { (window as any).wavoip?.device?.add(t, true); } catch {}
        }
        // Best-effort: subscribe to webphone events and persist call logs as fallback
        try {
          const wp: any = (window as any).wavoip;
          const onEvent = (ev: string) => async (payload: any) => {
            try {
              const status = ev.includes('answered') ? 'answered' : ev.includes('ended') ? 'ended' : ev.includes('rejected') ? 'rejected' : 'started';
              const direction = (payload?.direction || payload?.call?.direction || 'outbound').toLowerCase();
              await (supabase as any).from('wavoip_call_logs').insert({
                user_id: authUserId,
                direction: direction.includes('in') ? 'inbound' : 'outbound',
                status,
                from_number: payload?.from ?? payload?.call?.from ?? null,
                to_number: payload?.to ?? payload?.call?.to ?? null,
                whatsapp_jid: payload?.jid ?? payload?.call?.jid ?? null,
                duration_seconds: Number(payload?.duration ?? payload?.call?.duration ?? 0) || 0,
                end_reason: payload?.end_reason ?? null,
                started_at: payload?.started_at ?? null,
                answered_at: payload?.answered_at ?? null,
                ended_at: payload?.ended_at ?? null,
                metadata: { event: ev, source: 'webphone', payload },
              });
            } catch (err) { console.warn('[Wavoip] log insert failed', err); }
          };
          ['call:started', 'call:answered', 'call:ended', 'call:rejected'].forEach((e) => {
            try { wp?.on?.(e, onEvent(e)); } catch {}
          });
        } catch {}
        setReady(true);
      } catch (err) {
        console.warn('[Wavoip] render failed', err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActivePlan, authUserId]);

  const refreshDevices = useCallback(async () => {
    const tokens = await loadPlanAndDevices();
    if (!apiRef.current && !(window as any).wavoip) return;
    const wp: any = (window as any).wavoip;
    const current = (wp?.device?.get?.() ?? []).map((d: any) => d.token);
    for (const t of tokens) {
      if (!current.includes(t)) {
        try { wp.device.add(t, true); } catch {}
      }
    }
    for (const t of current) {
      if (!tokens.includes(t)) {
        try { wp.device.remove(t); } catch {}
      }
    }
  }, [loadPlanAndDevices]);

  const startCall = useCallback(async (phone: string, displayName?: string) => {
    const wp: any = (window as any).wavoip;
    if (!wp?.call?.start) return { ok: false, error: 'Webphone não inicializado' };
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return { ok: false, error: 'Telefone inválido' };
    try { wp.widget?.open?.(); } catch {}
    try {
      const res = await wp.call.start(digits, displayName ? { displayName } : undefined);
      if ((res as any)?.err) return { ok: false, error: (res as any).err?.message ?? 'Falha ao iniciar chamada' };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Erro ao chamar' };
    }
  }, []);

  const openWidget = useCallback(() => {
    const wp: any = (window as any).wavoip;
    try { wp?.widget?.open?.(); } catch {}
  }, []);

  const value = useMemo<WavoipContextValue>(() => ({
    ready, hasActivePlan, devicesCount, startCall, openWidget, refreshDevices,
  }), [ready, hasActivePlan, devicesCount, startCall, openWidget, refreshDevices]);

  return <WavoipContext.Provider value={value}>{children}</WavoipContext.Provider>;
}

export function useWavoip() {
  const ctx = useContext(WavoipContext);
  if (!ctx) throw new Error('useWavoip must be used within WavoipProvider');
  return ctx;
}