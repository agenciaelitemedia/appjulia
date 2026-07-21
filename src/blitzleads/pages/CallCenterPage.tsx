import { useMemo, useState } from "react";
import { AlertTriangle, Clock, CheckCircle2, TrendingUp, Loader2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBlitzCases, type BlitzCaseStatus, type BlitzCase } from "@/blitzleads/hooks/useBlitzCases";

const STATUS_TABS: { value: BlitzCaseStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "parou", label: "Parou" },
  { value: "objecao", label: "Objeção" },
  { value: "qualificado", label: "Qualificado" },
  { value: "nao_assinado", label: "Não assinado" },
  { value: "assinado", label: "Assinado" },
];

const STATUS_COLORS: Record<BlitzCaseStatus, string> = {
  parou: "border-l-red-500 bg-red-50/40",
  objecao: "border-l-amber-500 bg-amber-50/40",
  qualificado: "border-l-blue-500 bg-blue-50/40",
  nao_assinado: "border-l-orange-500 bg-orange-50/40",
  assinado: "border-l-emerald-500 bg-emerald-50/40",
};

function formatSla(deadline: string | null): { label: string; urgent: boolean } {
  if (!deadline) return { label: "Sem SLA", urgent: false };
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return { label: "SLA estourado", urgent: true };
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return { label: `${h}h ${m}m`, urgent: h < 2 };
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string | number; tone: string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center ${tone}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <div className="text-xs text-slate-500 uppercase font-medium">{label}</div>
        <div className="text-2xl font-bold text-slate-900 leading-tight">{value}</div>
      </div>
    </Card>
  );
}

function CaseCard({ c }: { c: BlitzCase }) {
  const sla = formatSla(c.sla_deadline);
  return (
    <Card className={`p-4 border-l-4 ${STATUS_COLORS[c.status] ?? "border-l-slate-300"} space-y-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 truncate">{c.contact_name}</div>
          <div className="text-xs text-slate-500 truncate">{c.phone ?? "sem telefone"}</div>
        </div>
        <Badge variant="secondary" className="text-xs">{c.score} pts</Badge>
      </div>
      {c.subject && <div className="text-sm text-slate-700 line-clamp-2">{c.subject}</div>}
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{c.product ?? "—"}</span>
        <span className={sla.urgent ? "text-red-600 font-medium" : "text-slate-500"}>
          <Clock className="w-3 h-3 inline mr-1" />{sla.label}
        </span>
      </div>
      {c.next_action && (
        <div className="text-xs text-slate-600 bg-slate-100 rounded px-2 py-1 truncate">→ {c.next_action}</div>
      )}
    </Card>
  );
}

export default function CallCenterPage() {
  const [tab, setTab] = useState<BlitzCaseStatus | "all">("all");
  const { data: cases = [], isLoading } = useBlitzCases(tab);
  const { data: allCases = [] } = useBlitzCases("all");

  const kpis = useMemo(() => {
    const urgent = allCases.filter((c) => {
      if (!c.sla_deadline) return false;
      return new Date(c.sla_deadline).getTime() - Date.now() < 2 * 3600_000;
    }).length;
    const breached = allCases.filter((c) => c.sla_deadline && new Date(c.sla_deadline).getTime() < Date.now()).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const recovered = allCases.filter((c) => c.status === "assinado" && new Date(c.updated_at) >= today).length;
    const signed = allCases.filter((c) => c.status === "assinado").length;
    const winRate = allCases.length > 0 ? Math.round((signed / allCases.length) * 100) : 0;
    return { urgent, breached, recovered, winRate };
  }, [allCases]);

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Recuperação de Oportunidades</h1>
        <p className="text-slate-500">Priorização por SLA, urgência e score de conversão</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={AlertTriangle} label="Casos urgentes" value={kpis.urgent} tone="bg-red-500" />
        <KpiCard icon={Clock} label="SLA estourado" value={kpis.breached} tone="bg-amber-500" />
        <KpiCard icon={CheckCircle2} label="Recuperados hoje" value={kpis.recovered} tone="bg-emerald-500" />
        <KpiCard icon={TrendingUp} label="Win rate" value={`${kpis.winRate}%`} tone="bg-blue-500" />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as BlitzCaseStatus | "all")}>
        <TabsList className="flex-wrap h-auto">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando casos...
            </div>
          ) : cases.length === 0 ? (
            <Card className="p-12 text-center text-slate-500">
              Nenhum caso encontrado. Adicione casos em BlitzLeads para iniciar a recuperação.
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cases.map((c) => <CaseCard key={c.id} c={c} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}