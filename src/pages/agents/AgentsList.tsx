import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Plus,
  MoreHorizontal,
  Settings,
  Trash2,
  QrCode,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { externalDb } from '@/lib/externalDb';
import { useToast } from '@/hooks/use-toast';

interface AgentListItem {
  id: number;
  cod_agent: string;
  status: 'active' | 'inactive';
  client_name: string;
  business_name: string;
  plan_name: string | null;
  plan_limit: number;
  leads_received: number;
  last_used: string | null;
  due_date: string | null;
}

const ITEMS_PER_PAGE = 20;

// Helper functions
const formatDueDate = (date: string | null): { text: string; diffDays: number } | null => {
  if (!date) return null;
  const dueDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return { text: `Dia ${dueDate.getDate()}`, diffDays };
};

const formatLastUsed = (date: string | null): string => {
  if (!date) return '-';
  const lastDate = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays < 7) return `${diffDays}d atrás`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}sem atrás`;
  return `${Math.floor(diffDays / 30)}m atrás`;
};

const getDueDateVariant = (diffDays: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (diffDays < 0) return 'destructive';
  if (diffDays <= 30) return 'secondary';
  return 'default';
};

const getUsageVariant = (used: number, limit: number): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (limit === 0) return 'outline';
  const percentage = (used / limit) * 100;
  if (percentage >= 100) return 'destructive';
  if (percentage >= 80) return 'secondary';
  return 'default';
};

export default function AgentsList() {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const query = `
        SELECT 
          a.id,
          a.cod_agent,
          a.status,
          c.name AS client_name,
          c.business_name,
          ap.name AS plan_name,
          COALESCE(ap."limit", 0) AS plan_limit,
          (
            SELECT COUNT(DISTINCT s.id)
            FROM sessions s
            WHERE s.agent_id = a.id
              AND EXISTS (
                SELECT 1 FROM log_messages lm 
                WHERE lm.session_id = s.id
                  AND lm.created_at >= DATE_TRUNC('month', CURRENT_DATE)
                  AND lm.created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
              )
          ) AS leads_received,
          a.last_used,
          a.due_date
        FROM agents a
        JOIN clients c ON c.id = a.client_id AND a.is_visibilided = true
        LEFT JOIN agents_plan ap ON ap.id = a.agent_plan_id
        ORDER BY c.business_name
      `;
      
      const result = await externalDb.raw<AgentListItem>({
        query,
        params: [],
      });
      setAgents(result);
    } catch (error) {
      console.error('Error loading agents:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar agentes',
        description: 'Não foi possível carregar a lista de agentes.',
      });
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAgentStatus = async (agent: AgentListItem) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    try {
      await externalDb.update({
        table: 'agents',
        data: { status: newStatus },
        where: { id: agent.id },
      });
      setAgents(prev =>
        prev.map(a => (a.id === agent.id ? { ...a, status: newStatus } : a))
      );
      toast({
        title: newStatus === 'active' ? 'Agente ativado' : 'Agente desativado',
        description: `${agent.business_name || agent.client_name} foi ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar o status do agente.',
      });
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(agents.length / ITEMS_PER_PAGE);
  const paginatedAgents = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return agents.slice(start, start + ITEMS_PER_PAGE);
  }, [agents, currentPage]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Status</TableHead>
                <TableHead>Cod. Agente</TableHead>
                <TableHead>Nome/Escritório</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Limite/Uso</TableHead>
                <TableHead>Last</TableHead>
                <TableHead>Venci.</TableHead>
                <TableHead className="w-[50px]">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-11" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-14" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  // Empty state
  if (agents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agentes IA</h1>
            <p className="text-muted-foreground">
              Gerencie seus agentes Julia e instâncias do WhatsApp
            </p>
          </div>
          <Button onClick={() => navigate('/admin/agentes/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Agente
          </Button>
        </div>
        <Card className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <CardTitle className="mb-2">Nenhum agente encontrado</CardTitle>
          <CardDescription className="mb-4">
            Crie seu primeiro agente Julia para começar
          </CardDescription>
          <Button onClick={() => navigate('/admin/agentes/novo')}>
            <Plus className="mr-2 h-4 w-4" />
            Criar Agente
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agentes IA</h1>
          <p className="text-muted-foreground">
            Gerencie seus agentes Julia e instâncias do WhatsApp
          </p>
        </div>
        <Button onClick={() => navigate('/admin/agentes/novo')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Agente
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead>Cod. Agente</TableHead>
              <TableHead>Nome/Escritório</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Limite/Uso</TableHead>
              <TableHead>Last</TableHead>
              <TableHead>Venci.</TableHead>
              <TableHead className="w-[50px]">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAgents.map((agent) => {
              const dueDateInfo = formatDueDate(agent.due_date);
              
              return (
                <TableRow key={agent.id}>
                  <TableCell>
                    <Switch
                      checked={agent.status === 'active'}
                      onCheckedChange={() => toggleAgentStatus(agent)}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {agent.cod_agent}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {agent.business_name || agent.client_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    {agent.plan_name || (
                      <span className="text-muted-foreground">Sem plano</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getUsageVariant(agent.leads_received, agent.plan_limit)}>
                      {agent.leads_received}/{agent.plan_limit}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatLastUsed(agent.last_used)}
                  </TableCell>
                  <TableCell>
                    {dueDateInfo ? (
                      <Badge variant={getDueDateVariant(dueDateInfo.diffDays)}>
                        {dueDateInfo.text}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/agente/personalizacao?id=${agent.id}`)}>
                          <Settings className="mr-2 h-4 w-4" />
                          Configurar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <QrCode className="mr-2 h-4 w-4" />
                          QR Code
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Ver conversas
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-muted-foreground">
              Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, agents.length)} de {agents.length} agentes
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
