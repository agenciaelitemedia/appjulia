import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type WavoipApi = any;

interface WavoipContextValue {
  ready: boolean;
  hasActivePlan: boolean;
  devicesCount: number;
  connectedNumbers: string[];
  canDial: boolean;
  ensureWebphone: () => Promise<WavoipApi | null>;
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
  const { user } = useAuth();
  const clientId = user?.client_id ?? null;
  const [hasActivePlan, setHasActivePlan] = useState(false);
  const [devicesCount, setDevicesCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [connectedNumbers, setConnectedNumbers] = useState<string[]>([]);
  const apiRef = useRef<WavoipApi | null>(null);
  const listenersBoundRef = useRef(false);

  const loadPlanAndDevices = useCallback(async (): Promise<{ active: boolean; tokens: string[] }> => {
    if (!clientId) {
      setHasActivePlan(false);
      setDevicesCount(0);
      setConnectedNumbers([]);
      return { active: false, tokens: [] };
    }
    const { data: plans } = await (supabase as any)
      .from('wavoip_user_plans')
      .select('id,is_active,status')
      .eq('client_id', clientId)
      .eq('is_active', true);
    const active = (plans ?? []).length > 0;
    setHasActivePlan(active);
    if (!active) {
      setDevicesCount(0);
      setConnectedNumbers([]);
      return { active: false, tokens: [] };
    }
    const { data: devs } = await (supabase as any)
      .from('wavoip_devices')
      .select('device_token,status,connection_status,whatsapp_jids')
      .eq('client_id', clientId)
      .eq('connection_status', 'connected');
    const tokens = (devs ?? []).map((d: any) => d.device_token).filter(Boolean);
    const numbers: string[] = [];
    for (const d of devs ?? []) {
      const j = Array.isArray(d?.whatsapp_jids) ? d.whatsapp_jids : [];
      for (const n of j) if (n) numbers.push(String(n));
    }
    setDevicesCount(tokens.length);
    setConnectedNumbers(numbers);
    return { active: true, tokens };
  }, [clientId]);

  const ensureWebphone = useCallback(async (): Promise<WavoipApi | null> => {
    if (apiRef.current || (window as any).wavoip) {
      apiRef.current = apiRef.current ?? (window as any).wavoip;
      setReady(true);
      return apiRef.current;
    }

    try {
      const webphone = await loadWebphone();
      const api = await webphone.render({
        theme: 'system',
        buttonPosition: 'bottom-right',
        position: 'bottom-right',
        widget: { startOpen: false, showWidgetButton: true },
        statusBar: { showNotificationsIcon: true, showSettingsIcon: true },
        settingsMenu: {
          deviceMenu: {
            show: true,
            showAddDevices: true,
            showEnableDevicesButton: true,
            showRemoveDevicesButton: true,
          },
        },
        callSettings: { displayName: 'Atendimento' },
        platform: 'atende-julia',
      });
      apiRef.current = api ?? (window as any).wavoip;

      if (!listenersBoundRef.current) {
        listenersBoundRef.current = true;
        try {
          const wp: any = apiRef.current ?? (window as any).wavoip;
          const onEvent = (ev: string) => async (payload: any) => {
            try {
              const status = ev.includes('answered') ? 'answered' : ev.includes('ended') ? 'ended' : ev.includes('rejected') ? 'rejected' : 'started';
              const direction = (payload?.direction || payload?.call?.direction || 'outbound').toLowerCase();
              await (supabase as any).from('wavoip_call_logs').insert({
                user_id: user?.id ?? null,
                client_id: clientId,
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
          ['call:started', 'call:answered', 'call:accepted', 'call:ended', 'call:rejected'].forEach((e) => {
            try { wp?.on?.(e, onEvent(e)); } catch {}
          });
        } catch {}
      }

      setReady(true);
      return apiRef.current;
    } catch (err) {
      console.warn('[Wavoip] render failed', err);
      return null;
    }
  }, [clientId, user?.id]);

  // Mount webphone when plan is active
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { active, tokens } = await loadPlanAndDevices();
      if (cancelled || !active) return;
      const wp = await ensureWebphone();
      if (!wp) return;
      for (const t of tokens) {
        try { wp?.device?.add?.(t, true); } catch {}
        try { wp?.device?.enable?.(t); } catch {}
      }
    })();
    return () => { cancelled = true; };
  }, [clientId, ensureWebphone, loadPlanAndDevices]);

  const refreshDevices = useCallback(async () => {
    const { tokens } = await loadPlanAndDevices();
    const wp: any = await ensureWebphone();
    if (!wp) return;
    const current = (wp?.device?.get?.() ?? []).map((d: any) => d.token);
    for (const t of tokens) {
      if (!current.includes(t)) {
        try { wp.device.add(t, true); } catch {}
      }
      try { wp.device.enable(t); } catch {}
    }
    for (const t of current) {
      if (!tokens.includes(t)) {
        try { wp.device.remove(t); } catch {}
      }
    }
  }, [ensureWebphone, loadPlanAndDevices]);

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

  const canDial = ready && devicesCount > 0;

  const value = useMemo<WavoipContextValue>(() => ({
    ready, hasActivePlan, devicesCount, connectedNumbers, canDial, ensureWebphone, startCall, openWidget, refreshDevices,
  }), [ready, hasActivePlan, devicesCount, connectedNumbers, canDial, ensureWebphone, startCall, openWidget, refreshDevices]);

  return <WavoipContext.Provider value={value}>{children}</WavoipContext.Provider>;
}

export function useWavoip() {
  const ctx = useContext(WavoipContext);
  if (!ctx) throw new Error('useWavoip must be used within WavoipProvider');
  return ctx;
}