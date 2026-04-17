import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Star, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCsatConfig, useSaveCsatConfig, useCsatStats } from '@/hooks/useChatCsatConfig';
import { subDays, formatISO } from 'date-fns';

export default function ChatCsatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = String(user?.id ?? '');
  const { data: config } = useCsatConfig(clientId);
  const save = useSaveCsatConfig();

  const dateRange = useMemo(() => ({
    from: formatISO(subDays(new Date(), 30)),
    to: formatISO(new Date()),
  }), []);
  const { data: stats } = useCsatStats(clientId, dateRange.from, dateRange.to);

  const [form, setForm] = useState({
    is_active: false,
    auto_send_after_resolve: true,
    delay_minutes: 5,
    survey_type: 'csat',
    message_template: 'Olá! Como você avalia o atendimento que recebeu hoje? Responda com uma nota de 1 a 5.',
    thank_you_message: 'Obrigado pelo seu feedback! 🙏',
  });

  useEffect(() => {
    if (config) {
      setForm({
        is_active: config.is_active,
        auto_send_after_resolve: config.auto_send_after_resolve,
        delay_minutes: config.delay_minutes,
        survey_type: config.survey_type,
        message_template: config.message_template,
        thank_you_message: config.thank_you_message,
      });
    }
  }, [config]);

  const handleSave = () => {
    save.mutate({ ...form, client_id: clientId, id: config?.id });
  };

  const responseRate = stats && stats.total > 0 ? (stats.responded / stats.total * 100).toFixed(1) : '0';
  const nps = stats && stats.responded > 0
    ? Math.round(((stats.promoters - stats.detractors) / stats.responded) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" /> CSAT & NPS
          </h2>
          <p className="text-muted-foreground text-sm">Pesquisas de satisfação e métricas dos últimos 30 dias</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Pesquisas enviadas</div>
            <div className="text-2xl font-bold">{stats?.total ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Taxa de resposta</div>
            <div className="text-2xl font-bold">{responseRate}%</div>
            <div className="text-[11px] text-muted-foreground">{stats?.responded ?? 0} respostas</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Nota média (CSAT)</div>
            <div className="text-2xl font-bold flex items-center gap-1">
              {stats?.averageScore.toFixed(2) ?? '0.00'}
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">NPS</div>
            <div className={`text-2xl font-bold ${nps >= 50 ? 'text-green-500' : nps >= 0 ? 'text-amber-500' : 'text-destructive'}`}>
              {nps}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-green-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-xs text-muted-foreground">Promotores (4-5)</div>
              <div className="text-xl font-bold text-green-500">{stats?.promoters ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-amber-500" />
            <div>
              <div className="text-xs text-muted-foreground">Neutros (3)</div>
              <div className="text-xl font-bold text-amber-500">{stats?.passives ?? 0}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-destructive/30">
          <CardContent className="p-4 flex items-center gap-3">
            <TrendingDown className="h-8 w-8 text-destructive" />
            <div>
              <div className="text-xs text-muted-foreground">Detratores (1-2)</div>
              <div className="text-xl font-bold text-destructive">{stats?.detractors ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By agent */}
      {stats && stats.byAgent.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Ranking por agente</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.byAgent.map(a => (
              <div key={a.cod_agent} className="flex items-center justify-between text-sm">
                <span className="font-mono">{a.cod_agent}</span>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{a.total} respostas</Badge>
                  <span className="font-bold flex items-center gap-1">
                    {a.avg.toFixed(2)} <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Config */}
      <Card>
        <CardHeader><CardTitle className="text-base">Configuração de envio automático</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ativar pesquisas automáticas</Label>
              <p className="text-xs text-muted-foreground">Enviar CSAT após o fim do atendimento</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Disparar quando conversa for resolvida</Label>
              <p className="text-xs text-muted-foreground">Caso desativado, dispare manualmente</p>
            </div>
            <Switch
              checked={form.auto_send_after_resolve}
              onCheckedChange={(v) => setForm({ ...form, auto_send_after_resolve: v })}
            />
          </div>
          <div>
            <Label>Atraso após resolução (minutos)</Label>
            <Input
              type="number"
              min={0}
              value={form.delay_minutes}
              onChange={e => setForm({ ...form, delay_minutes: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Mensagem de pesquisa</Label>
            <Textarea
              rows={3}
              value={form.message_template}
              onChange={e => setForm({ ...form, message_template: e.target.value })}
            />
          </div>
          <div>
            <Label>Mensagem de agradecimento</Label>
            <Input
              value={form.thank_you_message}
              onChange={e => setForm({ ...form, thank_you_message: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} disabled={save.isPending}>Salvar configuração</Button>
        </CardContent>
      </Card>
    </div>
  );
}
