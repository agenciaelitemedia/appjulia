import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdvboxIntegration } from '@/hooks/advbox/useAdvboxIntegration';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Scale, 
  Settings, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  RefreshCw,
  Database,
  Bell,
  MessageSquare,
  Eye,
  EyeOff,
  Trash2,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import { AdvboxAgentSelect } from '@/components/advbox/AdvboxAgentSelect';
import type { AdvboxIntegrationFormData, AdvboxSettings } from '@/types/advbox';

export default function AdvboxIntegrationPage() {
  const { user } = useAuth();
  const {
    integration,
    isLoading,
    isSaving,
    isTesting,
    loadIntegration,
    saveIntegration,
    testConnection,
    deleteIntegration,
  } = useAdvboxIntegration();

  const [selectedCodAgent, setSelectedCodAgent] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Form state
  const [formData, setFormData] = useState<AdvboxIntegrationFormData>({
    api_endpoint: '',
    api_token: '',
    is_active: false,
    settings: {
      auto_sync_interval: 300,
      enable_notifications: true,
      enable_client_queries: true,
      enable_lead_sync: true,
    },
  });

  // Load integration when agent changes
  useEffect(() => {
    if (selectedCodAgent) {
      loadIntegration(selectedCodAgent);
      setTestResult(null);
    }
  }, [selectedCodAgent, loadIntegration]);

  // Populate form when integration loads
  useEffect(() => {
    if (integration) {
      setFormData({
        api_endpoint: integration.api_endpoint || '',
        api_token: '', // Don't show encrypted token
        is_active: integration.is_active,
        settings: integration.settings || {
          auto_sync_interval: 300,
          enable_notifications: true,
          enable_client_queries: true,
          enable_lead_sync: true,
        },
      });
    } else {
      setFormData({
        api_endpoint: '',
        api_token: '',
        is_active: false,
        settings: {
          auto_sync_interval: 300,
          enable_notifications: true,
          enable_client_queries: true,
          enable_lead_sync: true,
        },
      });
    }
  }, [integration]);

  const handleTestConnection = async () => {
    if (!formData.api_endpoint || !formData.api_token) {
      setTestResult({ success: false, message: 'Preencha o endpoint e o token' });
      return;
    }
    const result = await testConnection(formData.api_endpoint, formData.api_token);
    setTestResult(result);
  };

  const handleSave = async () => {
    if (!selectedCodAgent) return;
    
    if (!formData.api_endpoint || !formData.api_token) {
      setTestResult({ success: false, message: 'Preencha o endpoint e o token' });
      return;
    }

    await saveIntegration(selectedCodAgent, formData);
  };

  const handleDelete = async () => {
    if (!integration?.id) return;
    
    if (confirm('Tem certeza que deseja remover a integração com Advbox?')) {
      await deleteIntegration(integration.id);
    }
  };

  const updateSettings = (key: keyof AdvboxSettings, value: boolean | number) => {
    setFormData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        [key]: value,
      },
    }));
  };

  const getConnectionStatusBadge = () => {
    if (!integration) return null;
    
    switch (integration.connection_status) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-primary">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive">
            <XCircle className="w-3 h-3 mr-1" />
            Erro
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <RefreshCw className="w-3 h-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Scale className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Integração Advbox</h1>
            <p className="text-muted-foreground">Configure a conexão com o sistema Advbox</p>
          </div>
        </div>
        {getConnectionStatusBadge()}
      </div>

      {/* Agent Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Selecionar Agente</CardTitle>
          <CardDescription>Escolha o agente para configurar a integração</CardDescription>
        </CardHeader>
        <CardContent>
          <AdvboxAgentSelect
            value={selectedCodAgent}
            onValueChange={setSelectedCodAgent}
            placeholder="Selecione um agente..."
          />
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && selectedAgentId && (
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-1/2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Form */}
      {selectedAgentId && !isLoading && (
        <>
          {/* Credentials Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                <CardTitle className="text-lg">Credenciais da API</CardTitle>
              </div>
              <CardDescription>
                Obtenha estas informações no painel do Advbox em Configurações → API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api_endpoint">Endpoint da API</Label>
                <Input
                  id="api_endpoint"
                  placeholder="https://api.advbox.com.br"
                  value={formData.api_endpoint}
                  onChange={(e) => setFormData(prev => ({ ...prev, api_endpoint: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="api_token">Token de Acesso</Label>
                <div className="relative">
                  <Input
                    id="api_token"
                    type={showToken ? 'text' : 'password'}
                    placeholder={integration ? '••••••••••••••••' : 'Cole seu token aqui'}
                    value={formData.api_token}
                    onChange={(e) => setFormData(prev => ({ ...prev, api_token: e.target.value }))}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                {integration && !formData.api_token && (
                  <p className="text-xs text-muted-foreground">
                    Token já configurado. Deixe em branco para manter o atual ou insira um novo para substituir.
                  </p>
                )}
              </div>

              {/* Test Connection */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={isTesting || !formData.api_endpoint || !formData.api_token}
                >
                  {isTesting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Testar Conexão
                </Button>

                {testResult && (
                  <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-destructive'}`}>
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    {testResult.message}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Features Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Funcionalidades</CardTitle>
              <CardDescription>Escolha quais recursos deseja ativar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Notificações Automáticas</p>
                    <p className="text-sm text-muted-foreground">
                      Enviar WhatsApp quando houver movimentações
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.settings.enable_notifications}
                  onCheckedChange={(checked) => updateSettings('enable_notifications', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MessageSquare className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Consultas via Chat</p>
                    <p className="text-sm text-muted-foreground">
                      Clientes podem perguntar sobre processos via WhatsApp
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.settings.enable_client_queries}
                  onCheckedChange={(checked) => updateSettings('enable_client_queries', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Database className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Sincronização de Leads</p>
                    <p className="text-sm text-muted-foreground">
                      Cadastrar leads automaticamente no Advbox
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.settings.enable_lead_sync}
                  onCheckedChange={(checked) => updateSettings('enable_lead_sync', checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Ativar Integração</p>
                    <p className="text-sm text-muted-foreground">
                      Habilita todas as funcionalidades configuradas
                    </p>
                  </div>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Statistics Card */}
          {integration && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Estatísticas (Últimas 24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{integration.total_processes_cached || 0}</p>
                    <p className="text-sm text-muted-foreground">Processos em Cache</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{integration.notifications_sent_24h || 0}</p>
                    <p className="text-sm text-muted-foreground">Notificações Enviadas</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <p className="text-2xl font-bold">{integration.queries_answered_24h || 0}</p>
                    <p className="text-sm text-muted-foreground">Consultas Respondidas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          {integration && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Gerenciamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button variant="outline" className="w-full justify-between" asChild>
                  <Link to="/advbox/regras">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      <span>Regras de Notificação</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <Link to="/advbox/processos">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      <span>Processos em Cache</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <Link to="/advbox/logs">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      <span>Histórico de Notificações</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="w-full justify-between" asChild>
                  <Link to="/advbox/consultas">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      <span>Consultas de Clientes</span>
                    </div>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Error Alert */}
          {integration?.last_error && (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>
                <strong>Último erro:</strong> {integration.last_error}
              </AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            {integration && (
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" />
                Remover Integração
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => selectedAgentId && loadIntegration(selectedAgentId)}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Recarregar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Salvar Configuração
              </Button>
            </div>
          </div>
        </>
      )}

      {/* No Agent Selected */}
      {!selectedAgentId && (
        <Card>
          <CardContent className="p-12 text-center">
            <Scale className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Selecione um Agente</h3>
            <p className="text-muted-foreground">
              Escolha um agente acima para configurar a integração com Advbox
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
