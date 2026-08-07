import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { XJLayout } from '../components/XJLayout';
import { XJQualificationBadge, XJStageBadge } from '../components/XJStageBadge';
import { useXJSessions } from '../hooks/useXJSessions';
import { XJ_STAGES, XJ_STAGE_LABELS, X_JULIA_ROUTES } from '../module';

export default function XJSessionsPage() {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [qualification, setQualification] = useState('all');
  const [onlyActive, setOnlyActive] = useState(false);

  const { data: sessions = [], isLoading } = useXJSessions({
    search,
    stage: stage === 'all' ? undefined : stage,
    qualification: qualification === 'all' ? undefined : qualification,
    onlyActive,
  });

  return (
    <XJLayout title="Atendimentos X-Julia" description="Sessões conduzidas pelo agente autônomo">
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 p-4">
          <Input
            placeholder="Buscar por nome, telefone ou caso..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72"
          />
          <Select value={stage} onValueChange={setStage}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estágios</SelectItem>
              {XJ_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {XJ_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={qualification} onValueChange={setQualification}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Qualificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="qualificado">Qualificado</SelectItem>
              <SelectItem value="desqualificado">Desqualificado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant={onlyActive ? 'default' : 'outline'} size="sm" onClick={() => setOnlyActive((v) => !v)}>
            Somente ativos
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum atendimento encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Caso</TableHead>
                  <TableHead>Estágio</TableHead>
                  <TableHead>Qualificação</TableHead>
                  <TableHead className="text-center">Turnos</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="font-medium">{session.contact_name || 'Sem nome'}</div>
                      <div className="text-xs text-muted-foreground">{session.phone || '—'}</div>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-sm">{session.case_type || '—'}</TableCell>
                    <TableCell>
                      <XJStageBadge stage={session.stage} />
                    </TableCell>
                    <TableCell>
                      <XJQualificationBadge value={session.qualification} />
                    </TableCell>
                    <TableCell className="text-center text-sm">{session.turns}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(session.updated_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="outline" className="rounded-full">
                        <Link to={X_JULIA_ROUTES.session(session.id)}>Abrir</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </XJLayout>
  );
}