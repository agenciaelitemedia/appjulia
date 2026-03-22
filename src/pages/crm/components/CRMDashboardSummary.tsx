import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Target, CheckCircle, XCircle, RotateCcw, MessageCircleReply } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { CRMCard, CRMStage, CRMFollowupInfo } from "../types";

interface FollowupReturnRateResult {
  totalLeads: number;
  returned: number;
  returnRate: number;
}

interface CRMDashboardSummaryProps {
  cards: CRMCard[];
  stages: CRMStage[];
  isLoading?: boolean;
  juliaSessions?: { totalSessions: number; dailyAverage: number };
  followupMap?: Map<string, CRMFollowupInfo>;
  returnRateData?: FollowupReturnRateResult;
}

export function CRMDashboardSummary({ cards, stages, isLoading, juliaSessions, followupMap, returnRateData }: CRMDashboardSummaryProps) {
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

    // FollowUp ativos
    const activeFollowups = followupMap ? Array.from(followupMap.values()) : [];
    const infiniteCount = activeFollowups.filter(f => f.is_infinite && f.step_number >= (f.followup_to ?? 0)).length;
    const stepsCount = activeFollowups.length - infiniteCount;

    const dailyMap = new Map<string, number>();
    cards.forEach((card) => {
      const date = card.stage_entered_at.split("T")[0];
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
      activeFollowups: activeFollowups.length,
      infiniteCount,
      stepsCount,
      dailyTrend,
    };
  }, [cards, stages, juliaSessions, followupMap]);

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
              <p className="text-xs text-muted-foreground">Leads atendidos pela Júlia</p>
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

      {/* 2. FollowUp Ativos */}
      <Card className="border-l-4 border-l-chart-3">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <RotateCcw className="h-3.5 w-3.5 text-chart-3" />
                <p className="text-xs text-muted-foreground font-medium">FollowUp Ativos</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.activeFollowups}</p>
              <p className="text-xs text-muted-foreground">
                Leads em cadência ativa
              </p>
            </div>
            <div className="p-2 bg-chart-3/10 rounded-full">
              <RotateCcw className="h-5 w-5 text-chart-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Taxa de Retorno */}
      <Card className="border-l-4 border-l-chart-1">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <MessageCircleReply className="h-3.5 w-3.5 text-chart-1" />
                <p className="text-xs text-muted-foreground font-medium">Taxa de Retorno</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{(returnRateData?.returnRate ?? 0).toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground">
                Leads que responderam ao followup
              </p>
            </div>
            <div className="p-2 bg-chart-1/10 rounded-full">
              <MessageCircleReply className="h-5 w-5 text-chart-1" />
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
                Conversão em contratos
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
                Leads em negociação ou contrato
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
                Leads sem perfil ou interesse
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
