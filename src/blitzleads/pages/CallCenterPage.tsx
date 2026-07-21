import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Phone } from "lucide-react";

/* ---------- Tokens da prototipagem ---------- */
const TRIG = {
  silent:    { color: "#ef4444", bg: "#fef2f2", bd: "#fecaca", label: "PAROU DE RESPONDER",       emoji: "🔴", pulse: true  },
  objection: { color: "#f59e0b", bg: "#fffbeb", bd: "#fde68a", label: "OBJEÇÃO",                  emoji: "🟠", pulse: true  },
  qualified: { color: "#8b5cf6", bg: "#f5f3ff", bd: "#ddd6fe", label: "QUALIFICADO S/ CONTRATO", emoji: "🟣", pulse: false },
  unsigned:  { color: "#3b82f6", bg: "#eff6ff", bd: "#bfdbfe", label: "CONTRATO NÃO ASSINADO",   emoji: "🔵", pulse: false },
  signed:    { color: "#10b981", bg: "#ecfdf5", bd: "#a7f3d0", label: "ASSINADO SEM CONTATO",    emoji: "🟢", pulse: false },
} as const;
type TrigKey = keyof typeof TRIG;

const FILTERS: { k: TrigKey | "todos"; label: string; color?: string }[] = [
  { k: "todos", label: "Todos" },
  { k: "silent",    label: "Parou",         color: "#ef4444" },
  { k: "objection", label: "Objeção",       color: "#f59e0b" },
  { k: "qualified", label: "Qualificado",   color: "#8b5cf6" },
  { k: "unsigned",  label: "Não assinado",  color: "#3b82f6" },
  { k: "signed",    label: "Assinado",      color: "#10b981" },
];

type ContractState = "" | "para_emitir" | "emitido" | "assinado";
type MockCase = {
  id: number;
  trigger: TrigKey;
  name: string;
  phone: string;
  caseLabel: string;
  urgent: boolean;
  priority: number;
  slaMin: number; // negativo = SLA estourado
  contract: ContractState;
};

/* Cards de exemplo — reproduzem o protótipo callcenter-recuperacao.html */
const MOCK_CASES: MockCase[] = [
  { id: 1, trigger: "unsigned",  name: "Maria Aparecida Silva",     phone: "(84) 99912-3456", caseLabel: "Plano de Saúde · Terapia ABA",  urgent: true,  priority: 94, slaMin: -18, contract: "emitido"  },
  { id: 2, trigger: "signed",    name: "Roberto Carlos dos Santos", phone: "(84) 99432-1098", caseLabel: "Auxílio-doença · Lombalgia",    urgent: true,  priority: 88, slaMin: -42, contract: "assinado" },
  { id: 3, trigger: "silent",    name: "Maria Silva",               phone: "(84) 99555-7788", caseLabel: "Plano de Saúde · Bariátrica",   urgent: true,  priority: 71, slaMin: -6,  contract: ""         },
  { id: 4, trigger: "objection", name: "João Pedro Alves",          phone: "(84) 99321-4455", caseLabel: "Plano de Saúde · Home care",    urgent: false, priority: 64, slaMin:  34, contract: ""         },
  { id: 5, trigger: "qualified", name: "Carlos Eduardo Lima",       phone: "(84) 99654-3210", caseLabel: "Plano de Saúde · Cirurgia joelho", urgent: false, priority: 58, slaMin: 120, contract: "para_emitir" },
  { id: 6, trigger: "silent",    name: "Francisca Oliveira",        phone: "(84) 99543-2109", caseLabel: "BPC/LOAS · Renda",              urgent: false, priority: 47, slaMin:  75, contract: ""         },
];

function fmtSla(min: number) {
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  const s = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
  return min < 0 ? `+${s}` : s;
}
const slaColor = (min: number) => (min < 0 ? "#dc2626" : min < 30 ? "#d97706" : "#059669");
const slaLabel = (min: number) => (min < 0 ? "SLA estourado" : "no prazo");

function ContractBadge({ c }: { c: ContractState }) {
  if (!c) return null;
  const map = {
    para_emitir: { bg: "#fffbeb", fg: "#d97706", dot: "#f59e0b", txt: "CONTRATO P/ EMITIR" },
    emitido:     { bg: "#eff6ff", fg: "#3b82f6", dot: "#3b82f6", txt: "CONTRATO EMITIDO"   },
    assinado:    { bg: "#ecfdf5", fg: "#059669", dot: "#10b981", txt: "CONTRATO ASSINADO"  },
  }[c];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[9.5px] font-extrabold" style={{ background: map.bg, color: map.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: map.dot }} />
      {map.txt}
    </span>
  );
}

function CaseCard({ c, onClick }: { c: MockCase; onClick: () => void }) {
  const t = TRIG[c.trigger];
  return (
    <button
      onClick={onClick}
      className="relative text-left w-full rounded-[15px] bg-white overflow-hidden transition-all hover:-translate-y-px"
      style={{
        border: `1.5px solid ${t.bd}`,
        padding: "14px 15px 13px 18px",
        boxShadow: "0 1px 2px rgba(15,23,42,.06),0 4px 12px rgba(15,23,42,.05)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 10px 30px rgba(15,23,42,.14)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 1px 2px rgba(15,23,42,.06),0 4px 12px rgba(15,23,42,.05)")}
    >
      <span className="absolute left-0 top-0 bottom-0 w-[5px]" style={{ background: t.color }} />
      <div className="flex justify-between gap-2.5 items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-[7px]">
            <span className="text-base">{t.emoji}</span>
            <span className="font-extrabold tracking-[-0.01em] text-[#0f172a]">{c.name}</span>
            {c.urgent && (
              <span className="text-[9.5px] font-extrabold px-[7px] py-[2px] rounded-full text-white" style={{ background: "#dc2626" }}>
                URGENTE
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mb-[7px]">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[10px] font-extrabold tracking-[0.02em] text-white ${t.pulse && c.urgent ? "animate-pulse" : ""}`}
              style={{ background: t.color }}
            >
              {t.label}
            </span>
            <ContractBadge c={c.contract} />
          </div>
          <div className="text-[12px]" style={{ color: "#94a3b8" }}>
            {c.caseLabel} · {c.phone}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <div className="text-base font-extrabold tracking-[-0.01em] tabular-nums" style={{ color: slaColor(c.slaMin) }}>
              {fmtSla(c.slaMin)}
            </div>
            <div className="text-[9px] uppercase tracking-[0.04em] font-bold" style={{ color: "#94a3b8" }}>
              {slaLabel(c.slaMin)}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-extrabold" style={{ color: "#64748b" }}>
            <Zap className="w-3 h-3 fill-current" />
            <span className="tabular-nums">{c.priority}</span>
          </span>
        </div>
      </div>
      <div
        className="mt-2.5 flex items-center gap-[7px] text-[12px] font-semibold rounded-[9px] px-2.5 py-[7px]"
        style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#64748b" }}
      >
        <Phone className="w-3.5 h-3.5" />
        <span>Próxima ação: <b className="text-[#0f172a]">Ligar (VoIP)</b></span>
      </div>
    </button>
  );
}

export default function CallCenterPage() {
  const [filter, setFilter] = useState<TrigKey | "todos">("todos");
  const navigate = useNavigate();

  const kpis = useMemo(() => {
    const urgent = MOCK_CASES.filter((c) => c.urgent).length;
    const overdue = MOCK_CASES.filter((c) => c.slaMin < 0).length;
    return { urgent, overdue, recovered: 3, winRate: 67 };
  }, []);

  const sorted = useMemo(
    () => [...MOCK_CASES].sort((a, b) => b.priority - a.priority || a.slaMin - b.slaMin),
    []
  );
  const items = filter === "todos" ? sorted : sorted.filter((c) => c.trigger === filter);
  const counts = (k: TrigKey | "todos") => (k === "todos" ? sorted.length : sorted.filter((c) => c.trigger === k).length);

  return (
    <div className="h-full overflow-y-auto" style={{ background: "#eef2f6" }}>
      {/* Apphead — crumb + título (do protótipo) */}
      <header
        className="h-14 flex items-center gap-3 px-5 border-b bg-white sticky top-0 z-10"
        style={{ borderColor: "#e2e8f0" }}
      >
        <div>
          <div className="text-[12px]" style={{ color: "#94a3b8" }}>Operação</div>
          <h1 className="text-[16px] font-extrabold tracking-[-0.01em] leading-none mt-0.5" style={{ color: "#0f172a" }}>
            Call Center · Recuperação
          </h1>
        </div>
        <div className="flex-1" />
        {kpis.overdue > 0 && (
          <span
            className="inline-flex items-center gap-1.5 px-[11px] py-1.5 rounded-full text-[12px] font-extrabold"
            style={{ background: "rgba(239,68,68,0.14)", color: "#ef4444" }}
          >
            <span className="w-[7px] h-[7px] rounded-full animate-pulse" style={{ background: "#ef4444" }} />
            {kpis.overdue} casos vencidos
          </span>
        )}
      </header>

      <div className="max-w-[1120px] mx-auto px-[22px] pt-[18px] pb-10">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { v: kpis.urgent,        l: "Casos urgentes",   color: "#dc2626" },
            { v: kpis.overdue,       l: "SLA estourado",    color: "#dc2626" },
            { v: kpis.recovered,     l: "Recuperados hoje", color: "#059669" },
            { v: `${kpis.winRate}%`, l: "Taxa de ganho",    color: "#0f172a" },
          ].map((k) => (
            <div
              key={k.l}
              className="rounded-[14px] bg-white px-4 py-[14px]"
              style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(15,23,42,.06),0 4px 12px rgba(15,23,42,.05)" }}
            >
              <div className="text-[27px] font-extrabold tracking-[-0.02em] leading-none tabular-nums" style={{ color: k.color }}>
                {k.v}
              </div>
              <div className="text-[11px] uppercase tracking-[0.05em] font-bold mt-1.5" style={{ color: "#94a3b8" }}>
                {k.l}
              </div>
            </div>
          ))}
        </div>

        {/* Filtros + CTA */}
        <div className="flex flex-wrap items-center gap-2.5 mb-3.5">
          <div className="flex flex-wrap gap-2 flex-1">
            {FILTERS.map((f) => {
              const active = filter === f.k;
              return (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-[7px] whitespace-nowrap px-[13px] py-2 rounded-[10px] text-[13px] font-bold transition-colors"
                  style={{
                    background: active ? "#0f172a" : "#ffffff",
                    color: active ? "#ffffff" : "#64748b",
                    border: `1px solid ${active ? "#0f172a" : "#e2e8f0"}`,
                  }}
                >
                  {f.color && <span className="w-2 h-2 rounded-full" style={{ background: f.color }} />}
                  {f.label}
                  <span className="text-[11px] font-extrabold tabular-nums opacity-70">{counts(f.k)}</span>
                </button>
              );
            })}
          </div>
          <button
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[11px] text-[13px] font-extrabold text-white whitespace-nowrap"
            style={{
              background: "linear-gradient(135deg,#2563eb,#4338ca)",
              boxShadow: "0 10px 30px rgba(15,23,42,.14)",
            }}
          >
            <Zap className="w-4 h-4 fill-white" /> Pegar próximo urgente
          </button>
        </div>

        {/* Lista */}
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))" }}>
          {items.length === 0 ? (
            <div className="col-span-full text-center py-16" style={{ color: "#94a3b8" }}>
              Nenhum caso nesse gatilho.
            </div>
          ) : (
            items.map((c) => (
              <CaseCard key={c.id} c={c} onClick={() => navigate(`/BlitzLead/case/${c.id}`)} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}