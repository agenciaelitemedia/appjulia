import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Target, Headphones, CheckCircle, XCircle } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { CRMCard, CRMStage } from "../types";

interface CRMDashboardSummaryProps {
  cards: CRMCard[];
  stages: CRMStage[];
  isLoading?: boolean;
  juliaSessions?: { totalSessions: number; dailyAverage: number };
}

const formatAvgTime = (days: number): string => {
  const totalHours = days * 24;
  
  if (totalHours < 24) {
    return `${Math.round(totalHours)}h`;
  }
  
  const fullDays = Math.floor(totalHours / 24);
  const remainingHours = Math.round(totalHours % 24);
  
  if (remainingHours === 0) {
    return `${fullDays}d`;
  }
  
  return `${fullDays}d ${remainingHours}h`;
};

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

    const avgTime =
      cards.length > 0
        ? cards.reduce((sum, card) => {
            const entered = new Date(card.stage_entered_at);
            const now = new Date();
            const days = (now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / cards.length
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

    const pieData = [
      { name: "Qualificados", value: qualified, color: "hsl(var(--chart-2))" },
      { name: "Desqualificados", value: disqualified, color: "hsl(var(--chart-5))" },
    ];

    return {
      total,
      converted,
      conversionRate,
      totalSessions,
      qualified,
      qualifiedRate,
      disqualified,
      disqualifiedRate,
      avgTime,
      dailyTrend,
      pieData,
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
      {/* 1. Whatsapp */}
      <Card className="border-l-4 border-l-chart-1">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium">Whatsapp</p>
              <p className="text-2xl font-bold text-foreground">{stats.total}</p>
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

      {/* 2. Atendimentos */}
      <Card className="border-l-4 border-l-chart-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Atendimentos</p>
              <p className="text-2xl font-bold text-foreground">{Math.round(juliaSessions?.dailyAverage ?? 0)}</p>
              <p className="text-xs text-muted-foreground">{stats.totalSessions} atendimentos da Julia</p>
            </div>
            <div className="p-2 bg-chart-4/10 rounded-full">
              <Headphones className="h-5 w-5 text-chart-4" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Tempo Médio */}
      <Card className="border-l-4 border-l-chart-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Tempo Médio</p>
              <p className="text-2xl font-bold text-foreground">{formatAvgTime(stats.avgTime)}</p>
              <p className="text-xs text-muted-foreground">na fase atual</p>
            </div>
            <div className="p-2 bg-chart-3/10 rounded-full">
              <Clock className="h-5 w-5 text-chart-3" />
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

      {/* 5. Qualificados */}
      <Card className="border-l-4 border-l-chart-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Qualificados</p>
              <p className="text-2xl font-bold text-foreground">{stats.qualifiedRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {stats.qualified} de {stats.totalSessions} atendimentos
              </p>
            </div>
            <div className="p-2 bg-chart-2/10 rounded-full">
              <CheckCircle className="h-5 w-5 text-chart-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6. Taxa Desqualificados */}
      <Card className="border-l-4 border-l-chart-5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Taxa Desqualificados</p>
              <p className="text-2xl font-bold text-foreground">{stats.disqualifiedRate.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                {stats.disqualified} de {stats.totalSessions} atendimentos
              </p>
            </div>
            <div className="w-12 h-12">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={12}
                    outerRadius={20}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {stats.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
