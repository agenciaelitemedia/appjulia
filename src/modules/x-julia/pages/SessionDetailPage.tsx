import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, MessageSquare, Pause, Play } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XJLayout } from '../components/XJLayout';
import { XJQualificationBadge, XJStageBadge } from '../components/XJStageBadge';
import { useXJSession, useXJSessionActions, useXJSessionEvents } from '../hooks/useXJSessions';
import { useOpenChatConversation } from '../extend/chat';
import { XJ_STAGES, XJ_STAGE_LABELS, X_JULIA_ROUTES } from '../module';

export default function XJSessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { data: session, isLoading } = useXJSession(sessionId);
  const { data: events = [] } = useXJSessionEvents(sessionId);
  const { pause, resume, setStage } = useXJSessionActions();
  const openChat = useOpenChatConversation();

  if (isLoading) {
    return (
      <XJLayout title="Atendimento">
        <Skeleton className="h-64 w-full" />
      </XJLayout>
    );
  }

  if (!session) {
    return (
      <XJLayout title="Atendimento">
        <p className="py-12 text-center text-sm text-muted-foreground">Atendimento não encontrado.</p>
      </XJLayout>
    );
  }

  const slots = Object.entries(session.slots || {});

  return (
    <XJLayout
      title={session.contact_name || session.phone || 'Atendimento'}
      description={session.case_type || 'Caso ainda não identificado'}
      actions={
        <>
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to={X_JULIA_ROUTES.sessions}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => openChat({ contactId: session.contact_id, phone: session.phone })}
          >
            <MessageSquare className="mr-1.5 h-4 w-4" /> Abrir chat
          </Button>
          {session.is_active ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={pause.isPending}
              onClick={() => pause.mutate(session.id)}
            >
              <Pause className="mr-1.5 h-4 w-4" /> Pausar agente
            </Button>
          ) : (
            <Button size="sm" className="rounded-full" disabled={resume.isPending} onClick={() => resume.mutate(session.id)}>
              <Play className="mr-1.5 h-4 w-4" /> Reativar agente
            </Button>
          )}
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Situação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Estágio</span>
              <XJStageBadge stage={session.stage} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Qualificação</span>
              <XJQualificationBadge value={session.qualification} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Agente</span>
              <Badge variant={session.is_active ? 'default' : 'secondary'}>
                {session.is_active ? 'Ativo' : session.paused_reason || 'Pausado'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Canal / origem</span>
              <span>{[session.channel, session.origin].filter(Boolean).join(' · ') || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Turnos</span>
              <span>{session.turns}</span>
            </div>
            <div className="pt-2">
              <p className="mb-1 text-xs text-muted-foreground">Mover estágio manualmente</p>
              <Select value={session.stage} onValueChange={(stage) => setStage.mutate({ sessionId: session.id, stage })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {XJ_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {XJ_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {session.qualification_reason && (
              <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">{session.qualification_reason}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dados coletados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {slots.length === 0 && <p className="text-muted-foreground">Nenhum dado coletado ainda.</p>}
            {slots.map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-3 border-b pb-1 last:border-0">
                <span className="text-muted-foreground">{key}</span>
                <span className="text-right font-medium">{String(value)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico do motor</CardTitle>
          </CardHeader>
          <CardContent className="max-h-[520px] space-y-2 overflow-y-auto">
            {events.length === 0 && <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>}
            {events.map((event) => (
              <div key={event.id} className="rounded-lg border p-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{event.skill || event.kind}</span>
                  <Badge variant={event.status === 'error' ? 'destructive' : 'secondary'} className="text-[10px]">
                    {event.status}
                  </Badge>
                </div>
                {event.detail && <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{event.detail}</p>}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(event.created_at).toLocaleString('pt-BR')}
                  {event.model ? ` · ${event.model}` : ''}
                  {event.duration_ms ? ` · ${event.duration_ms}ms` : ''}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </XJLayout>
  );
}