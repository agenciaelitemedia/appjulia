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
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200">
      <div className="flex items-center gap-4 px-6 h-16">
        {/* Search */}
        <div className="flex-1 max-w-md relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            placeholder="Buscar lead, telefone ou CPF..."
            className="w-full h-9 pl-9 pr-3 rounded-full bg-slate-100 text-sm placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-violet-200"
          />
        </div>

        {/* Alert chips */}
        <div className="hidden lg:flex items-center gap-2">
          {ALERTS.slice(0, 3).map((a) => {
            const t = TONE[a.tone];
            const Icon = a.icon;
            return (
              <div
                key={a.id}
                className={`inline-flex items-center gap-2 px-3 h-9 rounded-full bg-white border ${t.ring} text-xs`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${t.icon}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="font-semibold text-slate-800">{a.title}</span>
                <span className="text-slate-400">· {a.time}</span>
              </div>
            );
          })}
        </div>

        {/* Bell */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-600"
        >
          <Bell className="w-4 h-4" />
          {critical > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
              {critical}
            </span>
          )}
        </button>
      </div>

      {/* Dropdown de alertas completos */}
      {open && (
        <div className="absolute right-6 top-16 mt-2 w-96 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
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