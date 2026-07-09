import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type WavoipApi = any;

export interface WavoipDeviceInfo {
  id: string;
  token: string;
  name: string | null;
  connection_status: string;
}

interface WavoipContextValue {
  ready: boolean;
  hasActivePlan: boolean;
  devicesCount: number;
  connectedNumbers: string[];
  canDial: boolean;
  devices: WavoipDeviceInfo[];
  liveDeviceStatuses: Record<string, string>;
  ensureWebphone: () => Promise<WavoipApi | null>;
  startCall: (phoneE164: string, opts?: { displayName?: string; deviceId?: string }) => Promise<{ ok: boolean; error?: string }>;
  prefillDialer: (phoneE164: string, displayName?: string) => Promise<{ ok: boolean; error?: string }>;
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
  // Dispositivos do usuário logado — usados para injetar `displayName` = device_name
  // gravado em /wavoip ao habilitar o dispositivo, e para escolher o `fromTokens`.
  const userDevicesRef = useRef<WavoipDeviceInfo[]>([]);
  const [devices, setDevices] = useState<WavoipDeviceInfo[]>([]);
  // Status ao vivo do SDK por token (fonte da verdade — DB pode estar defasado).
  const [liveDeviceStatuses, setLiveDeviceStatuses] = useState<Record<string, string>>({});
  const liveDeviceStatusesRef = useRef<Record<string, string>>({});

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
    // Dispositivos: próprios + compartilhados via wavoip_device_members
    const { data: memberRows } = await (supabase as any)
      .from('wavoip_device_members')
      .select('device_id')
      .eq('app_user_id', Number(user?.id ?? -1));
    const sharedDeviceIds = (memberRows ?? [])
      .map((r: any) => r.device_id)
      .filter(Boolean);

    let devQuery = (supabase as any)
      .from('wavoip_devices')
      .select('id,device_token,device_name,status,connection_status,whatsapp_jids')
      .eq('client_id', clientId);
    if (sharedDeviceIds.length > 0) {
      const idsCsv = sharedDeviceIds.map((id: string) => `"${id}"`).join(',');
      devQuery = devQuery.or(`app_user_id.eq.${Number(user?.id ?? -1)},id.in.(${idsCsv})`);
    } else {
      devQuery = devQuery.eq('app_user_id', Number(user?.id ?? -1));
    }
    const { data: devs } = await devQuery;
    const allDevs = devs ?? [];
    // Um dispositivo só conta como "conectado" para o discador se o DB diz
    // connected E o SDK confirma (status open). Se o SDK ainda não respondeu,
    // confiamos no DB — a próxima reconciliação corrige.
    const liveMap = liveDeviceStatusesRef.current;
    const effectivelyConnected = allDevs.filter((d: any) => {
      if (d.connection_status !== 'connected') return false;
      const live = liveMap[d.device_token];
      if (!live) return true;
      return live === 'open' || live === 'connected';
    });
    const tokens = effectivelyConnected.map((d: any) => d.device_token).filter(Boolean);
    const numbers: string[] = [];
    for (const d of effectivelyConnected) {
      const j = Array.isArray(d?.whatsapp_jids) ? d.whatsapp_jids : [];
      for (const n of j) if (n) numbers.push(String(n));
    }
    setDevicesCount(tokens.length);
    setConnectedNumbers(numbers);
    userDevicesRef.current = allDevs.map((d: any) => ({
      id: d.id,
      token: d.device_token,
      name: d.device_name ?? null,
      connection_status: d.connection_status,
    }));
    setDevices(userDevicesRef.current);
    // Retorna todos os tokens conhecidos (para o SDK carregar) — quem filtra
    // por conexão real é o discador via devicesCount/connectedNumbers.
    const allTokens = allDevs.map((d: any) => d.device_token).filter(Boolean);
    return { active: true, tokens: allTokens };
  }, [clientId, user?.id]);

  const ensureWebphone = useCallback(async (): Promise<WavoipApi | null> => {
    if (apiRef.current || (window as any).wavoip) {
      apiRef.current = apiRef.current ?? (window as any).wavoip;
      setReady(true);
      return apiRef.current;
    }

    try {
      // Força tema claro em toda sessão: remove chaves de tema persistidas
      // pelo SDK e injeta CSS que oculta o toggle de tema e neutraliza
      // classes dark caso o SDK tente aplicá-las.
      try {
        ['wavoip:theme', 'wavoip-theme', 'wavoip.webphone.theme'].forEach((k) => {
          try { localStorage.removeItem(k); } catch {}
        });
      } catch {}
      if (typeof document !== 'undefined' && !document.getElementById('wavoip-force-light-style')) {
        const style = document.createElement('style');
        style.id = 'wavoip-force-light-style';
        style.textContent = `
          .wavoip-webphone, .wavoip-webphone * { color-scheme: light !important; }
          .wavoip-webphone[data-theme="dark"] { filter: none !important; }
          .wavoip-webphone-dark, .wavoip-theme-dark { display: none !important; }
          [data-testid="theme-toggle"], .wavoip-theme-switch, .wavoip-theme-toggle { display: none !important; }
        `;
        document.head.appendChild(style);
      }

      const webphone = await loadWebphone();
      const api = await webphone.render({
        theme: 'light',
        buttonPosition: 'bottom-right',
        position: 'bottom-right',
        widget: { startOpen: false, showWidgetButton: false },
        statusBar: { showNotificationsIcon: true, showSettingsIcon: true },
        settingsMenu: {
          deviceMenu: {
            show: true,
            // Desabilitado: quando true, o SDK lista TODOS os dispositivos da
            // conta Wavoip (compartilhada entre clientes). A gestão de
            // dispositivos vinculados ao client_id fica em /wavoip.
            showAddDevices: false,
            showEnableDevicesButton: true,
            showRemoveDevicesButton: false,
          },
        },
        callSettings: { displayName: 'Atendimento' },
        platform: 'atende-julia',
      });
      apiRef.current = api ?? (window as any).wavoip;

      // Reforça tema claro caso o SDK exponha API programática.
      try {
        const wp: any = apiRef.current;
        if (typeof wp?.setTheme === 'function') wp.setTheme('light');
        else if (typeof wp?.theme?.set === 'function') wp.theme.set('light');
      } catch {}

      if (!listenersBoundRef.current) {
        listenersBoundRef.current = true;
        try {
          const wp: any = apiRef.current ?? (window as any).wavoip;
          // Cache por dispositivo: id da chamada + direção travada no primeiro evento.
          type CallCache = { id: string; direction: 'inbound' | 'outbound'; deviceNumber?: string | null };
          const currentCallByToken = new Map<string, CallCache>();
          const currentCallById = new Map<string, CallCache>();

          const resolveDevice = async (token?: string | null): Promise<{ id: string | null; number: string | null }> => {
            if (!token) return { id: null, number: null };
            try {
              const { data } = await (supabase as any)
                .from('wavoip_devices').select('id,whatsapp_number,whatsapp_jids').eq('device_token', token).maybeSingle();
              const jids = Array.isArray(data?.whatsapp_jids) ? data.whatsapp_jids : [];
              const number = data?.whatsapp_number ?? (jids[0] ? String(jids[0]).replace(/\D/g, '') : null);
              return { id: data?.id ?? null, number: number ?? null };
            } catch { return { id: null, number: null }; }
          };

          const readActiveCall = (): any => {
            try { return wp?.call?.getCallActive?.() ?? null; } catch { return null; }
          };

          const scheduleRecordingFetch = (whatsappCallId: string) => {
            // Wavoip publica em storage.wavoip.com após alguns segundos. Retry com backoff.
            const delays = [5000, 15000, 30000, 60000, 120000];
            delays.forEach((delay) => {
              setTimeout(async () => {
                try {
                  const { data } = await (supabase as any)
                    .from('wavoip_call_logs')
                    .select('recording_status')
                    .eq('whatsapp_call_id', whatsappCallId)
                    .maybeSingle();
                  if (data?.recording_status === 'available') return;
                  await supabase.functions.invoke('wavoip-fetch-recording', {
                    body: { whatsapp_call_id: whatsappCallId },
                  });
                } catch (e) { /* silent retry */ }
              }, delay);
            });
          };

          const upsertCallLog = async (ev: string, payload: any) => {
            try {
              const active = readActiveCall();
              const isEnd = ev === 'call:ended';
              // Mapeamento oficial dos status terminais do SDK.
              const endedStatusMap: Record<string, string> = {
                ENDED: 'ended', FAILED: 'failed', REJECTED: 'rejected', NOT_ANSWERED: 'not_answered',
              };
              const rawEndStatus = String(payload?.status ?? '').toUpperCase();
              const status = ev === 'call:accepted' ? 'answered'
                : ev === 'call:ended' ? (endedStatusMap[rawEndStatus] ?? 'ended')
                : ev === 'offer:received' ? 'ringing'
                : 'started';

              const deviceToken = payload?.device_token ?? active?.device_token ?? null;
              const whatsappCallId = payload?.id ?? payload?.call?.id ?? active?.id
                ?? (deviceToken ? currentCallByToken.get(deviceToken)?.id : null);

              // Direção TRAVADA no primeiro evento — não confia em payload.direction depois.
              const cached = (whatsappCallId ? currentCallById.get(String(whatsappCallId)) : null)
                ?? (deviceToken ? currentCallByToken.get(deviceToken) : null)
                ?? null;
              let direction: 'inbound' | 'outbound';
              if (cached?.direction) {
                direction = cached.direction;
              } else if (ev === 'offer:received') {
                direction = 'inbound';
              } else if (ev === 'call:started') {
                direction = 'outbound';
              } else {
                // Fallback só quando não temos nada travado (evento chega solto).
                const rawDir = String(payload?.direction || payload?.call?.direction || active?.direction || '').toLowerCase();
                direction = rawDir.startsWith('in') || rawDir === 'incoming' ? 'inbound' : 'outbound';
              }

              const device = await resolveDevice(deviceToken);
              const deviceId = device.id;
              const deviceNumber = cached?.deviceNumber ?? device.number ?? null;

              if (whatsappCallId) {
                const entry: CallCache = { id: String(whatsappCallId), direction, deviceNumber };
                currentCallById.set(String(whatsappCallId), entry);
                if (deviceToken) currentCallByToken.set(deviceToken, entry);
              }

              const peer = payload?.peer || payload?.call?.peer || active?.peer || {};
              const peerNumber = (peer?.number ?? peer?.phone ?? null) as string | null;
              const fromNumber = direction === 'outbound' ? deviceNumber : (peerNumber ?? payload?.from ?? null);
              const toNumber   = direction === 'outbound' ? (peerNumber ?? payload?.to ?? null) : deviceNumber;

              const nowIso = new Date().toISOString();
              const baseRow: any = {
                client_id: clientId,
                app_user_id: user?.id ?? null,
                device_id: deviceId,
                direction,
                status,
                from_number: fromNumber,
                to_number: toNumber,
                whatsapp_jid: payload?.jid ?? payload?.call?.jid ?? null,
                duration_seconds: Number(payload?.duration ?? payload?.call?.duration ?? 0) || 0,
                end_reason: payload?.end_reason ?? null,
                started_at: payload?.started_at ?? (ev.includes('started') ? nowIso : null),
                answered_at: payload?.answered_at ?? (ev.includes('answered') || ev.includes('accepted') ? nowIso : null),
                ended_at: payload?.ended_at ?? (isEnd ? nowIso : null),
                metadata: { event: ev, source: 'webphone', payload },
              };

              if (whatsappCallId) {
                baseRow.whatsapp_call_id = String(whatsappCallId);
                baseRow.recording_status = isEnd ? 'pending' : 'unavailable';
                await (supabase as any)
                  .from('wavoip_call_logs')
                  .upsert(baseRow, { onConflict: 'whatsapp_call_id' });
                if (isEnd) {
                  scheduleRecordingFetch(String(whatsappCallId));
                  // Consolidar dados oficiais da chamada via API Wavoip.
                  try {
                    await supabase.functions.invoke('wavoip-fetch-call-details', {
                      body: { whatsapp_call_id: String(whatsappCallId), device_token: deviceToken, client_id: clientId },
                    });
                  } catch (e) { console.warn('[Wavoip] fetch-call-details failed', e); }
                  if (deviceToken) currentCallByToken.delete(deviceToken);
                  currentCallById.delete(String(whatsappCallId));
                }
              }
              // Sem whatsapp_call_id: NÃO grava nada. O webhook oficial da Wavoip
              // (configurado por dispositivo) é a fonte da verdade e fará o upsert.
            } catch (err) { console.warn('[Wavoip] log upsert failed', err); }
          };

          // Eventos reais do SDK Wavoip (docs: /webphone/referencia/api-publica).
          // NÃO existem `call:answered` nem `call:rejected` — `call:ended` traz o status terminal.
          ['call:started', 'call:accepted', 'call:ended', 'offer:received'].forEach((e) => {
            try { wp?.on?.(e, (payload: any) => upsertCallLog(e, payload)); } catch {}
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
      // Saneamento inicial: remove qualquer token que o SDK tenha carregado
      // do cache/conta Wavoip e não pertença ao client_id + app_user_id atual.
      try {
        const existing = (wp?.device?.get?.() ?? []).map((d: any) => d?.token).filter(Boolean);
        for (const t of existing) {
          if (!tokens.includes(t)) {
            try { wp.device.disable?.(t); } catch {}
            try { wp.device.remove?.(t); } catch {}
          }
        }
      } catch {}
      for (const t of tokens) {
        try { wp?.device?.add?.(t, true); } catch {}
        try { wp?.device?.enable?.(t); } catch {}
        try { supabase.functions.invoke('wavoip-configure-webhook', { body: { device_token: t } }); } catch {}
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
      try { supabase.functions.invoke('wavoip-configure-webhook', { body: { device_token: t } }); } catch {}
    }
    for (const t of current) {
      if (!tokens.includes(t)) {
        try { wp.device.remove(t); } catch {}
      }
    }
  }, [ensureWebphone, loadPlanAndDevices]);

  // ============================================================
  // Reconciliação contínua: status real do SDK -> DB e UI.
  // ============================================================
  const mapSdkStatusToDb = (raw: string | undefined | null): 'connected' | 'connecting' | 'disconnected' | 'error' | null => {
    if (!raw) return null;
    const s = String(raw).toLowerCase();
    if (s === 'open' || s === 'connected') return 'connected';
    if (s === 'connecting' || s === 'waiting_qr' || s === 'pairing') return 'connecting';
    if (s === 'error' || s === 'external_integration_error' || s === 'waiting_payment') return 'error';
    if (s === 'close' || s === 'closed' || s === 'disconnected' || s === 'logged_out' || s === 'logged-out') return 'disconnected';
    return null;
  };

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    let interval: number | null = null;

    const reconcile = async () => {
      const wp: any = apiRef.current ?? (window as any).wavoip;
      if (!wp?.device?.get) return;
      let entries: any[] = [];
      try { entries = wp.device.get() ?? []; } catch { return; }

      const nextLive: Record<string, string> = {};
      const known = userDevicesRef.current;
      let dirty = false;

      for (const dev of known) {
        const entry = entries.find((e: any) => e?.token === dev.token);
        const rawStatus = entry?.status;
        const mapped = mapSdkStatusToDb(rawStatus);
        nextLive[dev.token] = rawStatus ? String(rawStatus).toLowerCase() : 'disconnected';

        // Se o SDK não tem o token (nunca registrado) e o DB diz connected, é
        // uma inconsistência — trata como desconectado.
        const effective = mapped ?? (entry ? null : 'disconnected');
        if (!effective) continue;
        if (effective !== dev.connection_status) {
          dirty = true;
          try {
            const payload: Record<string, any> = {
              connection_status: effective,
              last_seen_at: new Date().toISOString(),
            };
            if (effective !== 'connected') payload.connected_at = null;
            await (supabase as any).from('wavoip_devices').update(payload).eq('id', dev.id);
          } catch (e) {
            console.warn('[Wavoip] reconcile update failed', e);
          }
        }
      }

      // Atualiza o mapa de status ao vivo se mudou.
      const prev = liveDeviceStatusesRef.current;
      const keys = new Set([...Object.keys(prev), ...Object.keys(nextLive)]);
      let liveChanged = false;
      for (const k of keys) { if (prev[k] !== nextLive[k]) { liveChanged = true; break; } }
      if (liveChanged) {
        liveDeviceStatusesRef.current = nextLive;
        if (!cancelled) setLiveDeviceStatuses(nextLive);
      }

      if (dirty && !cancelled) {
        await loadPlanAndDevices();
      }
    };

    // Primeiro tick após 3s (dá tempo do SDK carregar), depois a cada 10s.
    const kickoff = window.setTimeout(() => {
      void reconcile();
      interval = window.setInterval(() => { void reconcile(); }, 10_000);
    }, 3_000);

    return () => {
      cancelled = true;
      window.clearTimeout(kickoff);
      if (interval) window.clearInterval(interval);
    };
  }, [clientId, ready, loadPlanAndDevices]);

  const startCall = useCallback(async (phone: string, opts?: { displayName?: string; deviceId?: string }) => {
    const displayName = opts?.displayName;
    const deviceId = opts?.deviceId;
    const wp: any = (window as any).wavoip ?? await ensureWebphone();
    if (!wp?.call?.start) return { ok: false, error: 'Webphone não inicializado' };
    let digits = (phone || '').replace(/\D/g, '');
    if (!digits) return { ok: false, error: 'Telefone inválido' };
    // Normaliza para E.164 BR quando o número vier sem código do país.
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;

    // Escolhe o dispositivo do usuário para originar a chamada.
    // O displayName mostrado ao destinatário é o `device_name` gravado em /wavoip.
    const devices = userDevicesRef.current ?? [];
    const device = (deviceId ? devices.find((d) => d.id === deviceId) : null)
      ?? devices.find((d) => d.connection_status === 'connected')
      ?? devices[0] ?? null;
    const resolvedDisplayName = displayName ?? device?.name ?? 'Atendimento';
    const startConfig: any = { displayName: resolvedDisplayName };
    if (device?.token) startConfig.fromTokens = [device.token];

    try {
      const res: any = await wp.call.start(digits, startConfig);
      if (res?.err) {
        console.warn('[Wavoip] call.start error', res.err);
        return { ok: false, error: res.err?.message ?? 'Falha ao iniciar chamada' };
      }
      // Garante que a UI do webphone fique visível após o call.start.
      try { wp.widget?.open?.(); } catch {}

      // Upsert imediato com o whatsapp_call_id retornado pelo SDK.
      const whatsappCallId: string | null = res?.call?.id ? String(res.call.id) : null;
      if (whatsappCallId) {
        try {
          const nowIso = new Date().toISOString();
          // Descobre o número do dispositivo para gravar como from_number.
          let deviceNumber: string | null = null;
          try {
            const { data: devRow } = await (supabase as any)
              .from('wavoip_devices').select('whatsapp_number,whatsapp_jids').eq('id', device?.id ?? '').maybeSingle();
            const jids = Array.isArray(devRow?.whatsapp_jids) ? devRow.whatsapp_jids : [];
            deviceNumber = devRow?.whatsapp_number ?? (jids[0] ? String(jids[0]).replace(/\D/g, '') : null);
          } catch {}
          await (supabase as any).from('wavoip_call_logs').upsert({
            whatsapp_call_id: whatsappCallId,
            client_id: clientId,
            app_user_id: user?.id ?? null,
            device_id: device?.id ?? null,
            direction: 'outbound',
            status: 'started',
            from_number: deviceNumber,
            to_number: digits,
            started_at: nowIso,
            recording_status: 'unavailable',
            metadata: { source: 'webphone.start', displayName: resolvedDisplayName, peer: res?.call?.peer ?? null },
          }, { onConflict: 'whatsapp_call_id' });
        } catch (e) { console.warn('[Wavoip] start upsert failed', e); }
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Erro ao chamar' };
    }
  }, [ensureWebphone, clientId, user?.id]);

  const openWidget = useCallback(() => {
    const wp: any = (window as any).wavoip;
    try { wp?.widget?.open?.(); } catch {}
  }, []);

  const prefillDialer = useCallback(async (phone: string, displayName?: string) => {
    const wp: any = (window as any).wavoip ?? await ensureWebphone();
    if (!wp) return { ok: false, error: 'Webphone não inicializado' };
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) return { ok: false, error: 'Telefone inválido' };
    try { wp.widget?.open?.(); } catch {}

    // 1) API oficial do SDK Wavoip
    try {
      if (typeof wp?.call?.setInput === 'function') {
        wp.call.setInput(digits);
        return { ok: true };
      }
    } catch (e) { console.warn('[Wavoip] setInput failed', e); }

    // 2) Fallbacks legados (versões antigas do SDK)
    const sdkAttempts: Array<() => any> = [
      () => wp?.dialer?.setNumber?.(digits),
      () => wp?.dialer?.set?.(digits),
      () => wp?.widget?.setNumber?.(digits),
      () => wp?.widget?.dialer?.setNumber?.(digits),
      () => wp?.call?.prefill?.(digits, displayName ? { displayName } : undefined),
    ];
    for (const fn of sdkAttempts) {
      try {
        const r = fn();
        if (r !== undefined) return { ok: true };
      } catch {}
    }

    // 2) Fallback DOM: localizar input do discador e setar valor disparando eventos
    const setNativeValue = (el: HTMLInputElement, value: string) => {
      const proto = Object.getPrototypeOf(el);
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      desc?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const trySetDom = (): boolean => {
      const selectors = [
        'input[data-testid="dialer-input"]',
        'input[name="dialer"]',
        'input[name="phone"]',
        'input[type="tel"]',
        '[id*="wavoip" i] input',
        '[class*="wavoip" i] input',
        '[class*="dialer" i] input',
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (el) { setNativeValue(el, digits); el.focus(); return true; }
      }
      // Tenta iframe do widget
      const iframes = Array.from(document.querySelectorAll('iframe')) as HTMLIFrameElement[];
      for (const f of iframes) {
        try {
          const doc = f.contentDocument;
          if (!doc) continue;
          for (const sel of selectors) {
            const el = doc.querySelector(sel) as HTMLInputElement | null;
            if (el) { setNativeValue(el, digits); el.focus(); return true; }
          }
        } catch {}
      }
      return false;
    };

    // Aguarda widget renderizar
    for (let i = 0; i < 20; i++) {
      if (trySetDom()) return { ok: true };
      await new Promise((r) => setTimeout(r, 100));
    }
    return { ok: false, error: 'Não foi possível preencher o discador' };
  }, [ensureWebphone]);

  const canDial = ready && devicesCount > 0;

  const value = useMemo<WavoipContextValue>(() => ({
    ready, hasActivePlan, devicesCount, connectedNumbers, canDial, devices, liveDeviceStatuses, ensureWebphone, startCall, prefillDialer, openWidget, refreshDevices,
  }), [ready, hasActivePlan, devicesCount, connectedNumbers, canDial, devices, liveDeviceStatuses, ensureWebphone, startCall, prefillDialer, openWidget, refreshDevices]);

  return <WavoipContext.Provider value={value}>{children}</WavoipContext.Provider>;
}

export function useWavoip() {
  const ctx = useContext(WavoipContext);
  if (!ctx) throw new Error('useWavoip must be used within WavoipProvider');
  return ctx;
}