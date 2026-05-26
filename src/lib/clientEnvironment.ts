import { supabase } from '@/integrations/supabase/client';

export interface ClientEnvironment {
  browser: string | null;
  browser_version: string | null;
  os: string | null;
  os_version: string | null;
  device_type: 'desktop' | 'mobile' | 'tablet' | null;
  cpu_cores: number | null;
  device_memory_gb: number | null;
  gpu_renderer: string | null;
  screen_w: number | null;
  screen_h: number | null;
  dpr: number | null;
  viewport_w: number | null;
  viewport_h: number | null;
  net_effective_type: string | null;
  net_downlink_mbps: number | null;
  net_rtt_ms: number | null;
  save_data: boolean | null;
  language: string | null;
  timezone: string | null;
  user_agent: string | null;
}

// Tipos mínimos para APIs que o lib.dom não cobre totalmente.
interface UADataBrand { brand: string; version: string }
interface HighEntropyUAData {
  brands?: UADataBrand[];
  fullVersionList?: UADataBrand[];
  platform?: string;
  platformVersion?: string;
  mobile?: boolean;
  model?: string;
}
interface NavigatorUAData {
  brands?: UADataBrand[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<HighEntropyUAData>;
}
interface NetworkInformation {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

// ── Parse de User-Agent (fallback p/ Firefox/Safari sem UA-CH) ──
function parseUserAgent(ua: string): { browser: string | null; browser_version: string | null; os: string | null } {
  let browser: string | null = null;
  let browser_version: string | null = null;
  let os: string | null = null;

  if (/Edg\//.test(ua)) { browser = 'Edge'; browser_version = ua.match(/Edg\/([\d.]+)/)?.[1] ?? null; }
  else if (/OPR\/|Opera/.test(ua)) { browser = 'Opera'; browser_version = ua.match(/(?:OPR|Opera)\/([\d.]+)/)?.[1] ?? null; }
  else if (/Firefox\//.test(ua)) { browser = 'Firefox'; browser_version = ua.match(/Firefox\/([\d.]+)/)?.[1] ?? null; }
  else if (/Chrome\//.test(ua)) { browser = 'Chrome'; browser_version = ua.match(/Chrome\/([\d.]+)/)?.[1] ?? null; }
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) { browser = 'Safari'; browser_version = ua.match(/Version\/([\d.]+)/)?.[1] ?? null; }

  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  return { browser, browser_version, os };
}

function deviceTypeFromUA(ua: string, mobile?: boolean): ClientEnvironment['device_type'] {
  if (/iPad|Tablet/.test(ua)) return 'tablet';
  if (mobile || /Mobi|Android|iPhone/.test(ua)) return 'mobile';
  return 'desktop';
}

function readGpuRenderer(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return null;
    return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
  } catch {
    return null;
  }
}

export async function collectClientEnvironment(): Promise<ClientEnvironment> {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const parsed = parseUserAgent(ua);

  let browser = parsed.browser;
  let browser_version = parsed.browser_version;
  let os = parsed.os;
  let os_version: string | null = null;
  let mobile: boolean | undefined;

  // User-Agent Client Hints (Chromium) — dados mais confiáveis que o UA string.
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.getHighEntropyValues) {
    try {
      const high = await uaData.getHighEntropyValues(['platformVersion', 'fullVersionList', 'model']);
      mobile = uaData.mobile;
      if (high.platform) os = high.platform;
      if (high.platformVersion) os_version = high.platformVersion;
      const list = high.fullVersionList || high.brands || uaData.brands || [];
      // Ignora as marcas "fantasma" (Not.A/Brand, Chromium genérico).
      const real = list.find((b) => !/Not.?A.?Brand/i.test(b.brand) && b.brand !== 'Chromium') || list[0];
      if (real) { browser = real.brand; browser_version = real.version; }
    } catch {
      /* mantém fallback do UA */
    }
  }

  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;

  return {
    browser,
    browser_version,
    os,
    os_version,
    device_type: deviceTypeFromUA(ua, mobile),
    cpu_cores: typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : null,
    device_memory_gb: typeof mem === 'number' ? mem : null,
    gpu_renderer: readGpuRenderer(),
    screen_w: typeof screen !== 'undefined' ? screen.width : null,
    screen_h: typeof screen !== 'undefined' ? screen.height : null,
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio : null,
    viewport_w: typeof window !== 'undefined' ? window.innerWidth : null,
    viewport_h: typeof window !== 'undefined' ? window.innerHeight : null,
    net_effective_type: conn?.effectiveType ?? null,
    net_downlink_mbps: typeof conn?.downlink === 'number' ? conn.downlink : null,
    net_rtt_ms: typeof conn?.rtt === 'number' ? conn.rtt : null,
    save_data: typeof conn?.saveData === 'boolean' ? conn.saveData : null,
    language: typeof navigator !== 'undefined' ? navigator.language : null,
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return null; } })(),
    user_agent: ua ? ua.slice(0, 500) : null,
  };
}

export interface LogDeviceParams {
  userId: number;
  userName?: string | null;
  clientId?: number | null;
  env: ClientEnvironment;
}

/**
 * Persiste o snapshot de ambiente em `user_device_log`.
 * Falha silenciosamente — telemetria nunca deve quebrar o fluxo do app.
 */
export async function logUserDevice(params: LogDeviceParams): Promise<void> {
  try {
    await supabase.functions.invoke('telemetry', {
      body: {
        action: 'log_device',
        data: {
          user_id: params.userId,
          user_name: params.userName ?? null,
          client_id: params.clientId ?? null,
          ...params.env,
        },
      },
    });
  } catch (err) {
    console.warn('[clientEnvironment] failed', err);
  }
}
