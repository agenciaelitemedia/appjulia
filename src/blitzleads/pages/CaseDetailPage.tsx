import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Phone, MessageCircle, ChevronDown, Folder, MessageSquare, CheckCircle2, Zap, Mic, Send, XCircle } from "lucide-react";
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
      <summary className="list-none cursor-pointer p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          {title}
          {count !== undefined && <span className="text-slate-400 font-normal">({count})</span>}
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      {children && <div className="px-4 pb-4">{children}</div>}
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
  const messages = (meta?.messages ?? []) as { from: "julia" | "lead" | "att"; text: string; time: string }[];
  const steps = (meta?.steps ?? [
    { title: "Ligação (VoIP)", subtitle: "Ramal SIP do escritório", active: true },
    { title: "Ligação por WhatsApp", subtitle: "Zap call · Wavoip" },
    { title: "Áudio no WhatsApp", subtitle: "Mensagem de voz com script" },
    { title: "Texto no WhatsApp", subtitle: "Mensagem final de follow-up" },
  ]) as { title: string; subtitle: string; active?: boolean; done?: boolean }[];
  const timeline = (meta?.timeline ?? [
    { icon: "🎯", title: "Caso detectado", date: fmtDetected(c.sla_deadline), note: meta?.reason ?? "Contrato enviado há 1h12 e ainda não foi assinado." },
  ]) as { icon: string; title: string; date: string; note?: string }[];
  const doneSteps = steps.filter((s) => s.done).length;

  const statusMap: Record<BlitzCaseStatus, { label: string; tone: "rose" | "amber" | "violet" | "sky" | "emerald" }> = {
    parou: { label: "Parou de responder", tone: "rose" },
    objecao: { label: "Objeção", tone: "amber" },
    qualificado: { label: "Qualificado s/ contrato", tone: "violet" },
    nao_assinado: { label: "Contrato não assinado", tone: "sky" },
    assinado: { label: "Assinado sem contato", tone: "emerald" },
  };
  const st = statusMap[c.status];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-100">
      {/* Barra do caso (sticky) */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 text-sm font-medium shrink-0">
          <ChevronLeft className="w-4 h-4" /> Fila
        </button>
        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[c.status]}`} />
        <span className="text-[15px] font-bold text-slate-900 truncate">{c.contact_name}</span>
        <StatusPill tone={st.tone}>{st.label}</StatusPill>
        <div className="ml-auto flex items-center gap-4">
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500">
            <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> {c.score}
          </span>
          <div className="text-right">
            <div className={`text-lg font-bold leading-none ${sla.overdue ? "text-rose-600" : "text-slate-900"}`}>{sla.label}</div>
            <div className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${sla.overdue ? "text-rose-500" : "text-slate-400"}`}>{sla.sub}</div>
          </div>
        </div>
      </div>

      {/* Cockpit 2 painéis (chat sempre visível) */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(360px,44%)_1fr]">
        {/* Coluna esquerda: contexto + fluxo + desfecho + rastreabilidade */}
        <div className="overflow-y-auto p-4 space-y-3 lg:border-r border-slate-200">
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
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fluxo de recuperação</div>
              <div className="text-xs text-slate-400 tabular-nums">{doneSteps}/{steps.length} ações</div>
            </div>
            <div className="space-y-2.5">
              {steps.map((s, i) => {
                const active = s.active && !s.done;
                const done = s.done;
                return (
                  <div key={i} className={`bg-white rounded-2xl border p-4 ${active ? "border-sky-300 ring-2 ring-sky-100" : done ? "border-slate-200 opacity-95" : "border-slate-200"}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold ${active ? "bg-sky-600 text-white" : done ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 text-sm">{s.title}</div>
                        <div className="text-xs text-slate-500">{s.subtitle}</div>
                      </div>
                      {done && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">✓ Feito</span>}
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

          {/* Desfecho */}
          <div className="flex gap-2.5 pt-1">
            <button className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 font-bold text-sm hover:bg-emerald-100">
              <CheckCircle2 className="w-4 h-4" /> Marcar ganho
            </button>
            <button className="flex-1 inline-flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-rose-200 bg-rose-50 text-rose-700 font-bold text-sm hover:bg-rose-100">
              <XCircle className="w-4 h-4" /> Marcar perda
            </button>
          </div>

          {/* Rastreabilidade */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2 px-0.5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rastreabilidade</div>
              <div className="text-xs text-slate-400 tabular-nums">{timeline.length} eventos</div>
            </div>
            <div className="space-y-1">
              {timeline.slice().reverse().map((ev, i) => (
                <div key={i} className="flex gap-3 py-1.5">
                  <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-xs shrink-0">{ev.icon}</div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-slate-800">{ev.title}</div>
                    <div className="text-[11px] text-slate-400">{ev.date}</div>
                    {ev.note && <div className="text-xs text-slate-500 mt-0.5">{ev.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna direita: conversa (sempre visível) */}
        <div className="bg-white flex flex-col min-h-0">
          <div className="shrink-0 flex items-center justify-between p-4 border-b border-slate-100">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-slate-900 text-sm truncate">{c.contact_name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  WhatsApp · Julia inativa (você assumiu)
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button title="Ligar (VoIP)" className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </button>
              <button title="Ligar no WhatsApp" className="w-9 h-9 rounded-full bg-[#25d366] hover:brightness-95 text-emerald-950 flex items-center justify-center">
                <Phone className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-5 space-y-3 overflow-auto" style={{ backgroundColor: "#f5efe6" }}>
            {messages.length === 0 ? (
              <>
                <ChatBubble from="julia" author="Julia IA" text="Analisamos seu caso e você tem direito! Vou te enviar o contrato pra assinar 🙏" time="09:38" />
                <ChatBubble from="lead" text="Tá bom!" time="09:39" />
                <ChatBubble from="julia" author="Julia IA" text="Pronto, enviei o link de assinatura digital. É rapidinho 😊" time="09:40" />
              </>
            ) : (
              messages.map((m, i) => (
                <ChatBubble key={i} from={m.from} author={m.from === "julia" ? "Julia IA" : m.from === "att" ? "Você" : undefined} text={m.text} time={m.time} />
              ))
            )}
          </div>

          <div className="shrink-0 p-3 border-t border-slate-100 flex items-center gap-2">
            <button title="Anexar" className="w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 flex items-center justify-center shrink-0">
              <Folder className="w-4 h-4" />
            </button>
            <input
              className="flex-1 bg-slate-50 rounded-full px-4 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-200"
              placeholder="Escreva uma mensagem..."
            />
            <button title="Gravar áudio" className="w-9 h-9 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shrink-0">
              <Mic className="w-4 h-4" />
            </button>
            <button title="Enviar" className="w-9 h-9 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmtDetected(deadline: string | null) {
  if (!deadline) return "detectado";
  const diff = Date.now() - new Date(deadline).getTime();
  if (diff <= 0) return "detectado agora";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `há ${h > 0 ? `${h}h ` : ""}${m}m`;
}

function ChatBubble({ from, author, text, time }: { from: "julia" | "lead" | "att"; author?: string; text: string; time: string }) {
  const outgoing = from === "julia" || from === "att";
  const bg = from === "att" ? "bg-violet-100 text-violet-900" : from === "julia" ? "bg-emerald-100 text-slate-800" : "bg-white text-slate-800";
  const authorColor = from === "att" ? "text-violet-700" : "text-emerald-700";
  return (
    <div className={`flex ${outgoing ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${bg}`}>
        {author && <div className={`text-[11px] font-semibold mb-0.5 ${authorColor}`}>{author}</div>}
        <div className="text-sm leading-snug">{text}</div>
        <div className="text-[10px] text-slate-400 mt-1 text-right">{time}</div>
      </div>
    </div>
  );
}
