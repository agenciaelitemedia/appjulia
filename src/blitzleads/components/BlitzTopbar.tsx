import { AlertTriangle, Clock, Zap, Bell, Search, X } from "lucide-react";
import { useState } from "react";

type Alert = {
  id: string;
  tone: "rose" | "amber" | "violet" | "emerald";
  icon: typeof AlertTriangle;
  title: string;
  description: string;
  time: string;
};

const ALERTS: Alert[] = [
  {
    id: "1",
    tone: "rose",
    icon: AlertTriangle,
    title: "3 casos com SLA estourado",
    description: "Maria A. Silva, João P. e mais 1 aguardando retorno urgente",
    time: "agora",
  },
  {
    id: "2",
    tone: "amber",
    icon: Clock,
    title: "5 contratos sem assinatura há +24h",
    description: "Julia enviou mas o cliente não abriu o link",
    time: "há 12min",
  },
  {
    id: "3",
    tone: "violet",
    icon: Zap,
    title: "Novo lead qualificado — Ana R.",
    description: "Sem contrato enviado. Score 92 · INSS Auxílio-doença",
    time: "há 34min",
  },
  {
    id: "4",
    tone: "emerald",
    icon: Zap,
    title: "Contrato assinado — Carlos M.",
    description: "Recuperado após ligação de follow-up",
    time: "há 1h",
  },
];

const TONE = {
  rose: {
    dot: "bg-rose-500",
    icon: "text-rose-600 bg-rose-100",
    ring: "border-rose-200",
    accent: "text-rose-600",
  },
  amber: {
    dot: "bg-amber-500",
    icon: "text-amber-600 bg-amber-100",
    ring: "border-amber-200",
    accent: "text-amber-600",
  },
  violet: {
    dot: "bg-violet-500",
    icon: "text-violet-600 bg-violet-100",
    ring: "border-violet-200",
    accent: "text-violet-600",
  },
  emerald: {
    dot: "bg-emerald-500",
    icon: "text-emerald-600 bg-emerald-100",
    ring: "border-emerald-200",
    accent: "text-emerald-600",
  },
};

export function BlitzTopbar() {
  const [open, setOpen] = useState(false);
  const critical = ALERTS.filter((a) => a.tone === "rose" || a.tone === "amber").length;

  return (
    <header
      className="sticky top-0 z-30 h-14 flex items-center gap-3 px-5 border-b bg-white"
      style={{ borderColor: "#e2e8f0" }}
    >
      {/* Search — mantido do layout atual */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#94a3b8" }} />
        <input
          placeholder="Buscar lead, telefone ou CPF..."
          className="w-full h-9 pl-9 pr-3 rounded-full text-sm focus:outline-none focus:ring-2"
          style={{ background: "#f1f5f9", color: "#0f172a" }}
        />
      </div>

      <div className="flex-1" />

      {/* Bell — alertas mantidos do layout atual */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative w-[34px] h-[34px] rounded-[9px] flex items-center justify-center border"
          style={{ background: "#f8fafc", color: "#64748b", borderColor: "#e2e8f0" }}
        >
          <Bell className="w-4 h-4" />
          {critical > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[10px] font-bold flex items-center justify-center"
              style={{ background: "#ef4444" }}
            >
              {critical}
            </span>
          )}
        </button>

      {/* Dropdown de alertas completos */}
      {open && (
        <div
          className="absolute right-5 top-14 mt-2 w-96 rounded-2xl shadow-xl overflow-hidden border bg-white"
          style={{ borderColor: "#e2e8f0" }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-bold text-slate-900">Alertas</div>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="max-h-[420px] overflow-auto divide-y divide-slate-100">
            {ALERTS.map((a) => {
              const t = TONE[a.tone];
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${t.icon}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{a.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{a.description}</div>
                    <div className={`text-[11px] mt-1 font-medium ${t.accent}`}>{a.time}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}