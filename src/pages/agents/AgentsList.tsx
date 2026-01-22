import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Plus,
  MoreHorizontal,
  Settings,
  Trash2,
  Power,
  QrCode,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
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
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Agent {
  id: number;
  name: string;
  phone: string;
  status: 'active' | 'inactive' | 'disconnected';
  instance_id?: string;
  messages_sent?: number;
  messages_received?: number;
  created_at: string;
}

export default function AgentsList() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const query = user?.role === 'admin'
        ? `SELECT DISTINCT 
             cod_agent::int as id, 
             owner_name as name, 
             owner_business_name as phone,
             'active' as status,
             cod_agent as instance_id,
             0 as messages_sent,
             0 as messages_received,
             NOW() as created_at
           FROM "vw_list_client-agents-users" 
           WHERE cod_agent IS NOT NULL
           ORDER BY owner_name`
        : `SELECT DISTINCT 
             cod_agent::int as id, 
             owner_name as name, 
             owner_business_name as phone,
             'active' as status,
             cod_agent as instance_id,
             0 as messages_sent,
             0 as messages_received,
             NOW() as created_at
           FROM "vw_list_client-agents-users" 
           WHERE cod_agent = $1`;
      
      const params = user?.role === 'admin' ? [] : [user?.cod_agent];
      
      const result = await externalDb.raw<Agent>({
        query,
        params,
      });
      setAgents(result);
    } catch (error) {
      console.error('Error loading agents:', error);
      setAgents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAgentStatus = async (agent: Agent) => {
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
        description: `${agent.name} foi ${newStatus === 'active' ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Não foi possível alterar o status do agente.',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'inactive':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'disconnected':
        return 'Desconectado';
      default:
        return status;
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

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

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 w-32 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded mt-2" />
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : agents.length === 0 ? (
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
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription>{formatPhone(agent.phone)}</CardDescription>
                  </div>
                </div>
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
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="secondary"
                    className={`${getStatusColor(agent.status)} text-white`}
                  >
                    {getStatusLabel(agent.status)}
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Power className="h-4 w-4 text-muted-foreground" />
                    <Switch
                      checked={agent.status === 'active'}
                      onCheckedChange={() => toggleAgentStatus(agent)}
                      disabled={agent.status === 'disconnected'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {agent.messages_sent?.toLocaleString('pt-BR') || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Enviadas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">
                      {agent.messages_received?.toLocaleString('pt-BR') || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Recebidas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
