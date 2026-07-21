import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Loader2, Phone } from "lucide-react";
import { useBlitzCases, type BlitzCaseStatus, type BlitzCase } from "@/blitzleads/hooks/useBlitzCases";

type TabKey = BlitzCaseStatus | "all";

const TABS: { key: TabKey; label: string; dot?: string }[] = [
  { key: "all", label: "Todos" },
  { key: "parou", label: "Parou", dot: "bg-rose-500" },
  { key: "objecao", label: "Objeção", dot: "bg-amber-500" },
  { key: "qualificado", label: "Qualificado", dot: "bg-violet-500" },
  { key: "nao_assinado", label: "Não assinado", dot: "bg-sky-500" },
  { key: "assinado", label: "Assinado", dot: "bg-emerald-500" },
];

const STATUS_DOT: Record<BlitzCaseStatus, string> = {
  parou: "bg-rose-500",
  objecao: "bg-amber-500",
  qualificado: "bg-violet-500",
  nao_assinado: "bg-sky-500",
  assinado: "bg-emerald-500",
};

const STATUS_BORDER: Record<BlitzCaseStatus, string> = {
  parou: "border-l-rose-400",
  objecao: "border-l-amber-400",
  qualificado: "border-l-violet-400",
  nao_assinado: "border-l-sky-400",
  assinado: "border-l-emerald-400",
};

function slaInfo(deadline: string | null) {
  if (!deadline) return { label: "—", sub: "SEM SLA", overdue: false, urgent: false };
  const diff = new Date(deadline).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const label = h > 0 ? `${diff < 0 ? "+" : ""}${h}h${m > 0 ? ` ${m}m` : ""}` : `${diff < 0 ? "+" : ""}${m}m`;
  const overdue = diff < 0;
  const urgent = !overdue && diff < 2 * 3_600_000;
  return {
    label: overdue ? `+${h > 0 ? `${h}h` : ""}${m > 0 ? `${h > 0 ? " " : ""}${m}m` : h === 0 ? "0m" : ""}` : label,
    sub: overdue ? "SLA ESTOURADO" : "NO PRAZO",
    overdue,
    urgent,
  };
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: "rose" | "amber" | "violet" | "sky" | "emerald" }) {
  const map = {
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
    sky: "bg-sky-100 text-sky-700",
    emerald: "bg-emerald-100 text-emerald-700",
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide px-2.5 py-1 rounded-md ${map}`}>
      {children}
    </span>
  );
}

function statusMeta(s: BlitzCaseStatus): { tone: "rose" | "amber" | "violet" | "sky" | "emerald"; label: string } {
  switch (s) {
    case "parou": return { tone: "rose", label: "Parou de responder" };
    case "objecao": return { tone: "amber", label: "Objeção" };
    case "qualificado": return { tone: "violet", label: "Qualificado s/ contrato" };
    case "nao_assinado": return { tone: "sky", label: "Contrato não assinado" };
    case "assinado": return { tone: "emerald", label: "Assinado sem contato" };
  }
}

function CaseCard({ c, onClick }: { c: BlitzCase; onClick: () => void }) {
  const sla = slaInfo(c.sla_deadline);
  const meta = statusMeta(c.status);
  const isUrgent = sla.overdue || sla.urgent;
  const extraTag = (c.metadata as any)?.extra_tag as string | undefined;

  return (
    <button
      onClick={onClick}
      className={`group text-left bg-white rounded-2xl border border-slate-200 border-l-[6px] ${STATUS_BORDER[c.status]} p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[c.status]}`} />
            <h3 className="text-[15px] font-bold text-slate-900 truncate">{c.contact_name}</h3>
            {isUrgent && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-500 text-white px-1.5 py-0.5 rounded">
                Urgente
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
            {extraTag && <StatusPill tone="sky">{extraTag}</StatusPill>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-lg font-bold leading-none ${sla.overdue ? "text-rose-600" : isUrgent ? "text-amber-600" : "text-slate-900"}`}>
            {sla.label}
          </div>
          <div className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${sla.overdue ? "text-rose-500" : "text-slate-400"}`}>
            {sla.sub}
          </div>
          <div className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Zap className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="tabular-nums">{c.score}</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-3 truncate">
        {[c.product, c.subject, c.phone].filter(Boolean).join(" · ")}
      </div>

      {c.next_action && (
        <div className="bg-slate-50 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-slate-600">
          <Phone className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">Próxima ação:</span>
          <span className="font-semibold text-slate-800">{c.next_action}</span>
        </div>
      )}
    </button>
  );
}

export default function CallCenterPage() {
  const [tab, setTab] = useState<TabKey>("all");
  const { data: allCases = [], isLoading } = useBlitzCases("all");
  const navigate = useNavigate();

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { all: allCases.length, parou: 0, objecao: 0, qualificado: 0, nao_assinado: 0, assinado: 0 };
    for (const x of allCases) c[x.status]++;
    return c;
  }, [allCases]);

  const filtered = tab === "all" ? allCases : allCases.filter((c) => c.status === tab);

  const kpis = useMemo(() => {
    const urgent = allCases.filter((c) => c.sla_deadline && new Date(c.sla_deadline).getTime() - Date.now() < 2 * 3_600_000).length;
    const breached = allCases.filter((c) => c.sla_deadline && new Date(c.sla_deadline).getTime() < Date.now()).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const recovered = allCases.filter((c) => c.status === "assinado" && new Date(c.updated_at) >= today).length;
    const signed = allCases.filter((c) => c.status === "assinado").length;
    const winRate = allCases.length > 0 ? Math.round((signed / allCases.length) * 100) : 0;
    return { urgent, breached, recovered, winRate };
  }, [allCases]);

  return (
    <div className="max-w-[1400px] mx-auto p-8">
      <div className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Operação</div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[22px] font-bold text-slate-900 tracking-tight">Call Center · Recuperação</h1>
        {kpis.breached > 0 && (
          <span className="inline-flex items-center gap-2 bg-rose-100 text-rose-600 text-sm font-semibold px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {kpis.breached} casos vencidos
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-4xl font-bold text-rose-500 tabular-nums leading-none mb-2">{kpis.urgent}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Casos urgentes</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-4xl font-bold text-rose-500 tabular-nums leading-none mb-2">{kpis.breached}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SLA estourado</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-4xl font-bold text-emerald-500 tabular-nums leading-none mb-2">{kpis.recovered}</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Recuperados hoje</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <div className="text-4xl font-bold text-slate-900 tabular-nums leading-none mb-2">{kpis.winRate}%</div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Taxa de ganho</div>
        </div>
      </div>

      {/* Tabs + CTA */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          {TABS.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                  active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {t.dot && <span className={`w-2 h-2 rounded-full ${t.dot}`} />}
                <span>{t.label}</span>
                <span className={`text-xs tabular-nums ${active ? "text-slate-300" : "text-slate-400"}`}>{counts[t.key]}</span>
              </button>
            );
          })}
        </div>
        <button className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-sm">
          <Zap className="w-4 h-4 fill-white" /> Pegar próximo urgente
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando casos...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500">
          Nenhum caso encontrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((c) => (
            <CaseCard key={c.id} c={c} onClick={() => navigate(`/BlitzLead/case/${c.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}