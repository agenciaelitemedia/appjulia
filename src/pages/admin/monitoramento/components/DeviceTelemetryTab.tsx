import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Monitor, Smartphone, Tablet, Cpu, MemoryStick, Wifi, AlertTriangle,
  Chrome, Globe, Search, Gauge, Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { useUsersWithPermissions } from '../../permissoes/hooks/usePermissionsAdmin';
import { roleLabels } from '../../permissoes/types';
import type { UserWithPermissions } from '../../permissoes/types';
import {
  useUserDeviceLatest, useUserPerformance, deviceIsWeak, avg,
  type DeviceInfo,
} from '../hooks/useDeviceTelemetry';

function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone className="h-4 w-4" />;
  if (type === 'tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
}

function BrowserIcon({ browser }: { browser: string | null }) {
  if (browser === 'Chrome' || browser === 'Edge') return <Chrome className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
}

// LCP/load thresholds (Web Vitals)
function ratingClass(ms: number | null, good: number, poor: number): string {
  if (ms == null) return 'text-muted-foreground';
  if (ms <= good) return 'text-emerald-600 dark:text-emerald-400';
  if (ms <= poor) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function UserRow({ user, device, selected, onSelect }: {
  user: UserWithPermissions; device: DeviceInfo | undefined; selected: boolean; onSelect: () => void;
}) {
  const weak = deviceIsWeak(device);
  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
        selected ? 'bg-primary/5 border-primary/40' : 'hover:bg-muted/50',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{user.name}</span>
        {weak && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
      </div>
      {device ? (
        <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><DeviceIcon type={device.device_type} />{device.os ?? '—'}</span>
          <span className="flex items-center gap-1"><BrowserIcon browser={device.browser} />{device.browser ?? '—'}</span>
          {device.cpu_cores != null && <span className="flex items-center gap-1"><Cpu className="h-3 w-3" />{device.cpu_cores}c</span>}
          {device.device_memory_gb != null && <span className="flex items-center gap-1"><MemoryStick className="h-3 w-3" />{device.device_memory_gb}GB</span>}
          {device.net_effective_type && <span className="flex items-center gap-1"><Wifi className="h-3 w-3" />{device.net_effective_type}</span>}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-1">Sem dados de acesso ainda</p>
      )}
    </button>
  );
}

function InfoLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex justify-between gap-2 text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right truncate">{value ?? '—'}</span>
    </div>
  );
}

function TelemetryDetail({ user, device }: { user: UserWithPermissions; device: DeviceInfo | undefined }) {
  const { data: perf = [], isLoading } = useUserPerformance(user.id);

  const stats = useMemo(() => ({
    samples: perf.length,
    lcp: avg(perf.map((p) => p.lcp_ms)),
    load: avg(perf.map((p) => p.load_ms)),
    ttfb: avg(perf.map((p) => p.ttfb_ms)),
    fcp: avg(perf.map((p) => p.fcp_ms)),
    heap: avg(perf.map((p) => p.js_heap_used_mb)),
  }), [perf]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{user.name}</h3>
        <p className="text-sm text-muted-foreground">{user.email} · {roleLabels[user.role] ?? user.role}</p>
      </div>

      {deviceIsWeak(device) && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <span>Dispositivo/rede com risco de lentidão (poucos núcleos, pouca RAM ou rede lenta). Considere orientar sobre navegador, abas abertas ou conexão.</span>
        </div>
      )}

      {/* Métricas de performance */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gauge className="h-4 w-4 text-primary" />
          <h4 className="font-medium">Performance {stats.samples > 0 && <span className="text-xs text-muted-foreground">(média de {stats.samples} amostras)</span>}</h4>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : stats.samples === 0 ? (
          <p className="text-sm text-muted-foreground">Sem amostras de performance ainda.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div><p className="text-xs text-muted-foreground">LCP</p><p className={cn('text-lg font-bold', ratingClass(stats.lcp, 2500, 4000))}>{fmtMs(stats.lcp)}</p></div>
            <div><p className="text-xs text-muted-foreground">Carga total</p><p className={cn('text-lg font-bold', ratingClass(stats.load, 3000, 6000))}>{fmtMs(stats.load)}</p></div>
            <div><p className="text-xs text-muted-foreground">TTFB</p><p className={cn('text-lg font-bold', ratingClass(stats.ttfb, 800, 1800))}>{fmtMs(stats.ttfb)}</p></div>
            <div><p className="text-xs text-muted-foreground">FCP</p><p className={cn('text-lg font-bold', ratingClass(stats.fcp, 1800, 3000))}>{fmtMs(stats.fcp)}</p></div>
            <div><p className="text-xs text-muted-foreground">Heap JS</p><p className="text-lg font-bold">{stats.heap != null ? `${stats.heap}MB` : '—'}</p></div>
          </div>
        )}
      </Card>

      {/* Ambiente detalhado */}
      <Card className="p-4">
        <h4 className="font-medium mb-2">Ambiente</h4>
        {device ? (
          <div className="grid sm:grid-cols-2 gap-x-6">
            <div>
              <InfoLine label="Navegador" value={device.browser_version ? `${device.browser} ${device.browser_version}` : device.browser} />
              <InfoLine label="Sistema" value={device.os_version ? `${device.os} ${device.os_version}` : device.os} />
              <InfoLine label="Dispositivo" value={device.device_type} />
              <InfoLine label="Núcleos (CPU)" value={device.cpu_cores} />
              <InfoLine label="RAM aprox." value={device.device_memory_gb != null ? `${device.device_memory_gb} GB` : null} />
              <InfoLine label="GPU" value={device.gpu_renderer} />
            </div>
            <div>
              <InfoLine label="Rede" value={device.net_effective_type} />
              <InfoLine label="Downlink" value={device.net_downlink_mbps != null ? `${device.net_downlink_mbps} Mbps` : null} />
              <InfoLine label="Latência (RTT)" value={device.net_rtt_ms != null ? `${device.net_rtt_ms} ms` : null} />
              <InfoLine label="Tela" value={device.screen_w && device.screen_h ? `${device.screen_w}×${device.screen_h} @${device.dpr ?? 1}x` : null} />
              <InfoLine label="Idioma / Fuso" value={[device.language, device.timezone].filter(Boolean).join(' · ') || null} />
              <InfoLine label="Último acesso" value={device.occurred_at ? format(new Date(device.occurred_at), 'dd/MM/yyyy HH:mm') : null} />
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Este usuário ainda não acessou após a coleta ser ativada.</p>
        )}
      </Card>

      {/* Amostras recentes */}
      {perf.length > 0 && (
        <Card className="p-4">
          <h4 className="font-medium mb-2">Amostras recentes</h4>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {perf.slice(0, 30).map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b last:border-0">
                <span className="font-mono truncate flex-1">{p.route ?? '—'}</span>
                <span className={cn('w-16 text-right', ratingClass(p.lcp_ms, 2500, 4000))}>LCP {fmtMs(p.lcp_ms)}</span>
                <span className="w-16 text-right text-muted-foreground">{fmtMs(p.load_ms)}</span>
                <span className="w-28 text-right text-muted-foreground">{format(new Date(p.occurred_at), 'dd/MM HH:mm')}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export function DeviceTelemetryTab() {
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: users = [], isLoading } = useUsersWithPermissions(roleFilter === 'all' ? undefined : roleFilter);
  const userIds = useMemo(() => users.map((u) => u.id), [users]);
  const { data: devices = {} } = useUserDeviceLatest(userIds);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return users.filter((u) => !s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
  }, [users, search]);

  const selectedUser = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 260px)' }}>
      <Card className="lg:col-span-1 p-3 space-y-3 overflow-hidden flex flex-col">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuário" className="pl-8 h-9" />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(Object.keys(roleLabels)).map((r) => <SelectItem key={r} value={r}>{roleLabels[r as keyof typeof roleLabels]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário.</p>
          ) : (
            filtered.map((u) => (
              <UserRow key={u.id} user={u} device={devices[u.id]} selected={u.id === selectedId} onSelect={() => setSelectedId(u.id)} />
            ))
          )}
        </div>
      </Card>

      <div className="lg:col-span-2">
        {selectedUser ? (
          <TelemetryDetail key={selectedUser.id} user={selectedUser} device={devices[selectedUser.id]} />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Gauge className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Selecione um usuário</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Veja o ambiente de acesso (navegador, dispositivo, rede) e as métricas de performance para diagnosticar lentidão.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
