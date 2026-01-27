import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Copy, Check, CheckCircle, XCircle, Bot, User, Building2, CreditCard, Code2, MessageSquare, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { externalDb } from '@/lib/externalDb';
import { toast } from 'sonner';
import { maskCPFCNPJ, maskPhone } from '@/lib/inputMasks';

interface AgentDetails {
  id: number;
  cod_agent: string;
  status: boolean;
  is_closer: boolean;
  settings: string | Record<string, unknown>;
  prompt: string;
  due_date: number;
  created_at: string;
  
  client_id: number;
  client_name: string;
  business_name: string | null;
  federal_id: string | null;
  client_email: string | null;
  client_phone: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  
  plan_id: number | null;
  plan_name: string | null;
  plan_limit: number;
  
  user_id: number | null;
  user_name: string | null;
  user_email: string | null;
  remember_token: string | null;
  
  leads_received: number;
}

export default function AgentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [details, setDetails] = useState<AgentDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);
  
  // Get temp password from navigation state (when coming from wizard)
  const tempPasswordFromState = location.state?.tempPassword as string | undefined;
  
  useEffect(() => {
    if (id) {
      loadAgentDetails(parseInt(id));
    }
  }, [id]);
  
  const loadAgentDetails = async (agentId: number) => {
    try {
      const data = await externalDb.getAgentDetails<AgentDetails>(agentId);
      setDetails(data);
    } catch (error) {
      console.error('Error loading agent details:', error);
      toast.error('Erro ao carregar detalhes do agente');
    } finally {
      setIsLoading(false);
    }
  };
  
  const passwordToShow = tempPasswordFromState || details?.remember_token;
  const hasPassword = Boolean(passwordToShow);
  
  const handleCopyPassword = () => {
    if (passwordToShow) {
      navigator.clipboard.writeText(passwordToShow);
      setCopiedPassword(true);
      toast.success('Senha copiada!');
      setTimeout(() => setCopiedPassword(false), 2000);
    }
  };
  
  const formatAddress = () => {
    if (!details) return null;
    const parts = [
      details.street,
      details.street_number,
      details.complement,
      details.neighborhood,
      details.city && details.state ? `${details.city}/${details.state}` : details.city || details.state,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
  };
  
  const formatJsonSettings = () => {
    if (!details?.settings) return '{}';
    
    // Se já é objeto (JSONB), formatar diretamente
    if (typeof details.settings === 'object') {
      return JSON.stringify(details.settings, null, 2);
    }
    
    // Se é string, tentar parsear
    try {
      return JSON.stringify(JSON.parse(details.settings), null, 2);
    } catch {
      return details.settings;
    }
  };
  
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  
  if (!details) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => navigate('/admin/agentes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar à listagem
        </Button>
        <Card className="flex flex-col items-center justify-center py-12">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Agente não encontrado</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => navigate('/admin/agentes')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar à listagem
        </Button>
        <Button onClick={() => navigate(`/admin/agentes/${id}/editar`)}>
          <Pencil className="mr-2 h-4 w-4" />
          Editar
        </Button>
      </div>
      
      {/* Block 1: Access Data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Dados de Acesso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="text-sm text-muted-foreground">Usuário:</span>
              <p className="font-medium">{details.user_email || <span className="text-muted-foreground">-</span>}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Senha:</span>
              <div className="flex items-center gap-2">
                {hasPassword ? (
                  <>
                    <code className="font-mono bg-muted px-2 py-1 rounded text-sm">{passwordToShow}</code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleCopyPassword}
                    >
                      {copiedPassword ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                ) : (
                  <span className="font-mono text-muted-foreground">••••••••••</span>
                )}
              </div>
            </div>
          </div>
          {details.user_name && (
            <div>
              <span className="text-sm text-muted-foreground">Nome do usuário:</span>
              <p className="font-medium">{details.user_name}</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Block 2: Agent Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5" />
            Informações do Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className="text-sm text-muted-foreground">Código:</span>
              <p className="font-mono font-medium">{details.cod_agent}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="flex items-center gap-2 mt-1">
                {details.status ? (
                  <Badge variant="default" className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <XCircle className="h-3 w-3" />
                    Inativo
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Modo Closer:</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={details.is_closer ? 'default' : 'outline'}>
                  {details.is_closer ? 'Sim' : 'Não'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Block 3: Client Data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" />
            Dados do Cliente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-sm text-muted-foreground">Nome:</span>
              <p className="font-medium">{details.client_name || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Razão Social:</span>
              <p className="font-medium">{details.business_name || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">CPF/CNPJ:</span>
              <p className="font-medium font-mono">
                {details.federal_id ? maskCPFCNPJ(details.federal_id) : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Email:</span>
              <p className="font-medium">{details.client_email || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Telefone:</span>
              <p className="font-medium font-mono">
                {details.client_phone ? maskPhone(details.client_phone) : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Endereço:</span>
              <p className="font-medium">{formatAddress() || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Block 4: Plan and Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" />
            Plano e Limites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <span className="text-sm text-muted-foreground">Plano:</span>
              <p className="font-medium">{details.plan_name || 'Sem plano'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Limite de Leads:</span>
              <p className="font-medium">{details.plan_limit || 0}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Dia de Vencimento:</span>
              <p className="font-medium">{details.due_date || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Uso Atual:</span>
              <Badge variant={details.leads_received >= details.plan_limit ? 'destructive' : 'default'}>
                {details.leads_received}/{details.plan_limit}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Block 5: Settings (JSON) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="h-5 w-5" />
            Configurações (JSON)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <pre className="p-4 text-sm font-mono">{formatJsonSettings()}</pre>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Block 6: System Prompt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Prompt do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] w-full rounded-md border">
            <p className="p-4 text-sm whitespace-pre-wrap">{details.prompt || '-'}</p>
          </ScrollArea>
        </CardContent>
      </Card>
      
      {/* Bottom Navigation */}
      <Button variant="outline" onClick={() => navigate('/admin/agentes')}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar à listagem
      </Button>
    </div>
  );
}
