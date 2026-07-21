import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Phone, MessageCircle, ChevronDown, Folder, MessageSquare, CheckCircle2, Zap } from "lucide-react";
import { useBlitzCases, type BlitzCase, type BlitzCaseStatus } from "@/blitzleads/hooks/useBlitzCases";

const STATUS_DOT: Record<BlitzCaseStatus, string> = {
  parou: "bg-rose-500",
  objecao: "bg-amber-500",
  qualificado: "bg-violet-500",
  nao_assinado: "bg-sky-500",
  assinado: "bg-emerald-500",
};

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

function slaLabel(deadline: string | null) {
  if (!deadline) return { label: "—", sub: "SEM SLA", overdue: false };
  const diff = new Date(deadline).getTime() - Date.now();
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  const label = `${diff < 0 ? "+" : ""}${h > 0 ? `${h}h` : ""}${m > 0 ? `${h > 0 ? " " : ""}${m}m` : h === 0 ? "0m" : ""}`;
  return { label, sub: diff < 0 ? "SLA ESTOURADO" : "NO PRAZO", overdue: diff < 0 };
}

function Section({ title, count, children, defaultOpen = true }: { title: string; count?: number; children?: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="bg-white rounded-2xl border border-slate-200 group">
      <summary className="list-none cursor-pointer p-5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          {title}
          {count !== undefined && <span className="text-slate-400 font-normal">({count})</span>}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      {children && <div className="px-5 pb-5">{children}</div>}
    </details>
  );
}

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: cases = [] } = useBlitzCases("all");
  const c = useMemo(() => cases.find((x) => x.id === id) as BlitzCase | undefined, [cases, id]);

  if (!c) {
    return (
      <div className="max-w-[1400px] mx-auto p-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 mb-6">
          <ChevronLeft className="w-4 h-4" /> Fila
        </button>
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">Caso não encontrado.</div>
      </div>
    );
  }

  const sla = slaLabel(c.sla_deadline);
  const meta = c.metadata as any;
  const collected = (meta?.collected ?? {}) as Record<string, string>;
  const messages = (meta?.messages ?? []) as { from: "julia" | "lead"; text: string; time: string }[];
  const steps = (meta?.steps ?? [
    { title: "Ligação (VoIP)", subtitle: "Ramal SIP do escritório", active: true },
    { title: "Ligação por WhatsApp", subtitle: "Zap call · Wavoip" },
    { title: "Áudio no WhatsApp", subtitle: "Mensagem de voz com script" },
    { title: "Texto no WhatsApp", subtitle: "Mensagem final de follow-up" },
  ]) as { title: string; subtitle: string; active?: boolean; done?: boolean }[];

  const statusPills: { label: string; tone: "rose" | "amber" | "violet" | "sky" | "emerald" }[] = (() => {
    const map: Record<BlitzCaseStatus, { label: string; tone: any }> = {
      parou: { label: "Parou de responder", tone: "rose" },
      objecao: { label: "Objeção", tone: "amber" },
      qualificado: { label: "Qualificado s/ contrato", tone: "violet" },
      nao_assinado: { label: "Contrato não assinado", tone: "sky" },
      assinado: { label: "Assinado sem contato", tone: "emerald" },
    };
    return [map[c.status]];
  })();

  return (
    <div className="max-w-[1400px] mx-auto p-8">
      <div className="mb-1 text-xs font-medium text-slate-500 uppercase tracking-wide">Operação</div>
      <h1 className="text-[22px] font-bold text-slate-900 tracking-tight mb-6">Call Center · Recuperação</h1>

      {/* Sub-header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium">
            <ChevronLeft className="w-4 h-4" /> Fila
          </button>
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[c.status]}`} />
          <span className="text-lg font-bold text-slate-900">{c.contact_name}</span>
          {statusPills.map((p, i) => (
            <StatusPill key={i} tone={p.tone}>{p.label}</StatusPill>
          ))}
        </div>
        <div className="text-right">
          <div className={`text-xl font-bold leading-none ${sla.overdue ? "text-rose-600" : "text-slate-900"}`}>{sla.label}</div>
          <div className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${sla.overdue ? "text-rose-500" : "text-slate-400"} flex items-center justify-end gap-2`}>
            {sla.sub}
            <span className="inline-flex items-center gap-1 text-slate-500">
              <Zap className="w-3 h-3 fill-amber-400 text-amber-400" /> {c.score}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left column */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-start gap-3">
            <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-sm text-slate-700">
              <span className="font-semibold">Por que caiu aqui:</span>{" "}
              {meta?.reason ?? "Contrato enviado há 1h12 e ainda não foi assinado."}
            </div>
          </div>

          <Section title="Dados coletados pela Julia">
            <div className="divide-y divide-slate-100 text-sm">
              {Object.keys(collected).length === 0 ? (
                <div className="text-slate-400 py-2">Sem dados coletados.</div>
              ) : (
                Object.entries(collected).map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[110px_1fr] gap-4 py-2.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</div>
                    <div className="text-slate-800">{v}</div>
                  </div>
                ))
              )}
            </div>
            {c.status === "qualificado" && (
              <div className="mt-3">
                <StatusPill tone="emerald"><CheckCircle2 className="w-3 h-3" /> Qualificado</StatusPill>
              </div>
            )}
          </Section>

          <Section title="Ligações" count={(meta?.calls?.length ?? 1)} defaultOpen={false} />
          <Section title="Arquivos" count={(meta?.files?.length ?? 1)} defaultOpen={false} />

          {/* Fluxo de recuperação */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fluxo de recuperação</div>
              <div className="text-xs text-slate-400">
                {steps.filter((s) => s.done).length}/{steps.length} ações
              </div>
            </div>
            <div className="space-y-3">
              {steps.map((s, i) => {
                const active = s.active;
                return (
                  <div
                    key={i}
                    className={`bg-white rounded-2xl border p-4 ${active ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${active ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm">{s.title}</div>
                        <div className="text-xs text-slate-500">{s.subtitle}</div>
                      </div>
                    </div>
                    {active && (
                      <>
                        <button className="mt-4 w-full inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl shadow-sm">
                          <Phone className="w-4 h-4" /> Ligar
                        </button>
                        <div className="mt-2 text-center text-xs text-slate-400">
                          Execute e registre o resultado para liberar o próximo passo.
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: chat */}
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col min-h-[600px]">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{c.contact_name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  WhatsApp · Julia inativa (você assumiu)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </button>
              <button className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 p-5 space-y-3 overflow-auto" style={{ backgroundColor: "#f5efe6" }}>
            {messages.length === 0 ? (
              <>
                <ChatBubble from="julia" author="Julia IA" text="Analisamos seu caso e você tem direito! Vou te enviar o contrato pra assinar 🙏" time="09:38" />
                <ChatBubble from="lead" text="Tá bom!" time="09:39" />
                <ChatBubble from="julia" author="Julia IA" text="Pronto, enviei o link de assinatura digital. É rapidinho 😊" time="09:40" />
              </>
            ) : (
              messages.map((m, i) => (
                <ChatBubble key={i} from={m.from} author={m.from === "julia" ? "Julia IA" : undefined} text={m.text} time={m.time} />
              ))
            )}
          </div>

          <div className="p-3 border-t border-slate-100 flex items-center gap-2">
            <button className="w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center">
              <Folder className="w-4 h-4" />
            </button>
            <input
              className="flex-1 bg-slate-50 rounded-full px-4 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Escreva uma mensagem..."
            />
            <button className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </button>
            <button className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Phone className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ from, author, text, time }: { from: "julia" | "lead"; author?: string; text: string; time: string }) {
  const isJulia = from === "julia";
  return (
    <div className={`flex ${isJulia ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${isJulia ? "bg-emerald-100 text-slate-800" : "bg-white text-slate-800"}`}>
        {author && <div className="text-[11px] font-semibold text-emerald-700 mb-0.5">{author}</div>}
        <div className="text-sm leading-snug">{text}</div>
        <div className="text-[10px] text-slate-400 mt-1 text-right">{time}</div>
      </div>
    </div>
  );
}