import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Target, CheckCircle, XCircle, User } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { CRMCard, CRMStage } from "../types";

interface CRMDashboardSummaryProps {
  cards: CRMCard[];
  stages: CRMStage[];
  isLoading?: boolean;
  juliaSessions?: { totalSessions: number; dailyAverage: number };
}

const formatAvgTime = (days: number): string => {
  const totalHours = days * 24;
  if (totalHours < 1) return "< 1h";
  if (totalHours < 24) return `${Math.round(totalHours)}h`;
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = Math.round(totalHours % 24);
  if (remainingHours === 0) return `${fullDays}d`;
  return `${fullDays}d ${remainingHours}h`;
};

const JULIA_PHASES = [
  { name: "Entrada", short: "Entrada" },
  { name: "Análise de Caso", short: "Análise" },
  { name: "Negociação", short: "Negociação" },
  { name: "Contrato em Curso", short: "Contrato" },
];

export function CRMDashboardSummary({ cards, stages, isLoading, juliaSessions }: CRMDashboardSummaryProps) {
  const stats = useMemo(() => {
    const total = cards.length;

    const contractInProgressStage = stages.find((s) => s.name === "Contrato em Curso");
    const contractSignedStage = stages.find((s) => s.name === "Contrato Assinado");
    const negotiationStage = stages.find((s) => s.name === "Negociação");
    const disqualifiedStage = stages.find((s) => s.name === "Desqualificado");

    const converted = cards.filter(
      (c) => c.stage_id === contractInProgressStage?.id || c.stage_id === contractSignedStage?.id,
    ).length;
    const disqualified = cards.filter((c) => c.stage_id === disqualifiedStage?.id).length;
    const qualified = cards.filter(
      (c) =>
        c.stage_id === negotiationStage?.id ||
        c.stage_id === contractInProgressStage?.id ||
        c.stage_id === contractSignedStage?.id,
    ).length;

    const totalSessions = juliaSessions?.totalSessions ?? 0;
    const conversionRate = totalSessions > 0 ? (converted / totalSessions) * 100 : 0;
    const qualifiedRate = totalSessions > 0 ? (qualified / totalSessions) * 100 : 0;
    const disqualifiedRate = totalSessions > 0 ? (disqualified / totalSessions) * 100 : 0;

    // Tempo médio por fase da Julia
    const phaseStats = JULIA_PHASES.map((phase) => {
      const stage = stages.find((s) => s.name === phase.name);
      if (!stage) return { ...phase, avgDays: 0, count: 0 };
      const phaseCards = cards.filter((c) => c.stage_id === stage.id);
      if (phaseCards.length === 0) return { ...phase, avgDays: 0, count: 0 };
      const totalDays = phaseCards.reduce((sum, card) => {
        const entered = new Date(card.stage_entered_at);
        const now = new Date();
        return sum + (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24);
      }, 0);
      return { ...phase, avgDays: totalDays / phaseCards.length, count: phaseCards.length };
    });

    const maxPhaseDays = Math.max(...phaseStats.map((p) => p.avgDays), 1);

    // Média geral da Julia (média ponderada por quantidade de cards em cada fase)
    const totalJuliaCards = phaseStats.reduce((sum, p) => sum + p.count, 0);
    const juliaAvgDays = totalJuliaCards > 0
      ? phaseStats.reduce((sum, p) => sum + p.avgDays * p.count, 0) / totalJuliaCards
      : 0;

    // Tempo médio humano (ciclo de vida do card no CRM)
    const resolvedStageIds = [contractSignedStage?.id, disqualifiedStage?.id].filter(Boolean);
    const resolvedCards = cards.filter((c) => resolvedStageIds.includes(c.stage_id));
    const activeCards = cards.filter((c) => !resolvedStageIds.includes(c.stage_id));

    const now = new Date();
    const resolvedAvgDays = resolvedCards.length > 0
      ? resolvedCards.reduce((sum, card) => {
          const entered = new Date(card.stage_entered_at);
          const updated = new Date(card.updated_at);
          return sum + (updated.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / resolvedCards.length
      : 0;

    const activeAvgDays = activeCards.length > 0
      ? activeCards.reduce((sum, card) => {
          const entered = new Date(card.stage_entered_at);
          return sum + (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24);
        }, 0) / activeCards.length
      : 0;

    const totalHumanCards = resolvedCards.length + activeCards.length;
    const humanAvgDays = totalHumanCards > 0
      ? (resolvedAvgDays * resolvedCards.length + activeAvgDays * activeCards.length) / totalHumanCards
      : 0;

    const dailyMap = new Map<string, number>();
    cards.forEach((card) => {
      const date = card.created_at.split("T")[0];
      dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
    });

    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-7);

    return {
      total,
      converted,
      conversionRate,
      totalSessions,
      qualified,
      qualifiedRate,
      disqualified,
      disqualifiedRate,
      phaseStats,
      maxPhaseDays,
      juliaAvgDays,
      totalJuliaCards,
      dailyTrend,
      humanAvgDays,
      resolvedCount: resolvedCards.length,
      activeCount: activeCards.length,
    };
  }, [cards, stages, juliaSessions]);

  if (isLoading) {
    return (
       <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {/* 1. Atendimentos */}
      <Card className="border-l-4 border-l-chart-1">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium">Atendimentos</p>
              <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
              <p className="text-xs text-muted-foreground">total no período</p>
            </div>
            <div className="w-20 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.dailyTrend}>
                  <Line type="monotone" dataKey="count" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Média Tempo Julia */}
      <Card className="border-l-4 border-l-chart-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3.5 w-3.5 text-chart-3" />
                <p className="text-xs text-muted-foreground font-medium">Média Júlia</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatAvgTime(stats.juliaAvgDays)}</p>
              <p className="text-xs text-muted-foreground">
                Média de tempo por fase
              </p>
            </div>
            <div className="p-2 bg-chart-3/10 rounded-full">
              <Clock className="h-5 w-5 text-chart-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tempo Humano */}
      <Card className="border-l-4 border-l-chart-1">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <User className="h-3.5 w-3.5 text-chart-1" />
                <p className="text-xs text-muted-foreground font-medium">Tempo Humano</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{formatAvgTime(stats.humanAvgDays)}</p>
              <p className="text-xs text-muted-foreground">
                {stats.resolvedCount} resolvidos · {stats.activeCount} em andamento
              </p>
            </div>
            <div className="p-2 bg-chart-1/10 rounded-full">
              <Clock className="h-5 w-5 text-chart-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Taxa Contratos */}
      <Card className="border-l-4 border-l-chart-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Taxa Contratos</p>
              <p className="text-2xl font-bold text-foreground">{stats.conversionRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {stats.converted} de {stats.totalSessions} atendimentos
              </p>
            </div>
            <div className="p-2 bg-chart-2/10 rounded-full">
              <Target className="h-5 w-5 text-chart-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Qualificados */}
      <Card className="border-l-4 border-l-chart-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Qualificados</p>
              <p className="text-2xl font-bold text-foreground">{stats.qualifiedRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {stats.qualified} de {stats.totalSessions} atendimentos
              </p>
            </div>
            <div className="p-2 bg-chart-4/10 rounded-full">
              <CheckCircle className="h-5 w-5 text-chart-4" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. Desqualificado */}
      <Card className="border-l-4 border-l-chart-5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Desqualificado</p>
              <p className="text-2xl font-bold text-foreground">{stats.disqualifiedRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {stats.disqualified} de {stats.totalSessions} atendimentos
              </p>
            </div>
            <div className="p-2 bg-chart-5/10 rounded-full">
              <XCircle className="h-5 w-5 text-chart-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
