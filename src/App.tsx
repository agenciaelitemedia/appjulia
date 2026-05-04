import { Toaster } from "@/components/ui/toaster";
import { lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UaZapiProvider } from "@/contexts/UaZapiContext";
import { DebugProvider } from "@/contexts/DebugContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { AdvLayout } from "@/components/layout/AdvLayout";
import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { DebugBar } from "@/components/debug/DebugBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CRMPage from "./pages/crm/CRMPage";
import CRMStatisticsPage from "./pages/crm/statistics/CRMStatisticsPage";
import CRMMonitoringPage from "./pages/crm/monitoring/CRMMonitoringPage";
import CRMBuilderPage from "./pages/crm-builder/CRMBuilderPage";
import BoardPage from "./pages/crm-builder/BoardPage";
import AgentsList from "./pages/agents/AgentsList";
import CreateAgentPage from "./pages/agents/CreateAgentPage";
import AgentDetailsPage from "./pages/agents/AgentDetailsPage";
import EditAgentPage from "./pages/agents/EditAgentPage";
import DesempenhoPage from "./pages/estrategico/desempenho/DesempenhoPage";
import ContratosPage from "./pages/estrategico/contratos/ContratosPage";
import CampanhasPage from "./pages/estrategico/campanhas/CampanhasPage";
import FollowupPage from "./pages/agente/followup/FollowupPage";
import MyAgentsPage from "./pages/agente/meus-agentes/MyAgentsPage";
import MyAgentEditPage from "./pages/agente/meus-agentes/MyAgentEditPage";
import CriativosPage from "./pages/criativos/CriativosPage";
import EquipePage from "./pages/equipe/EquipePage";
import ProfileSettingsPage from "./pages/profile/ProfileSettingsPage";
import PermissoesPage from "./pages/admin/permissoes/PermissoesPage";
import MetaTestPage from "./pages/admin/meta-test/MetaTestPage";
import ModulosPage from "./pages/admin/modulos/ModulosPage";
import VideoQueuePage from "./pages/video/VideoQueuePage";
import JoinCallPage from "./pages/video/JoinCallPage";
import ChatPage from "./pages/chat/ChatPage";
import ChatChannelsPage from "./pages/chat/ChatChannelsPage";
import ChatMetricsPage from "./pages/chat/ChatMetricsPage";
import ChatAutomationsPage from "./pages/chat/ChatAutomationsPage";
import ChatWebhooksPage from "./pages/chat/ChatWebhooksPage";
import ChatSlaConfigPage from "./pages/chat/ChatSlaConfigPage";
import ChatSettingsPage from "./pages/chat/ChatSettingsPage";
import ChatApiKeysPage from "./pages/chat/ChatApiKeysPage";
import ChatKnowledgeBasePage from "./pages/chat/ChatKnowledgeBasePage";
import ChatCsatPage from "./pages/chat/ChatCsatPage";
import ChatBotsPage from "./pages/chat/ChatBotsPage";
import ChatCampaignsPage from "./pages/chat/ChatCampaignsPage";
import ChatBotBuilderPage from "./pages/chat/ChatBotBuilderPage";
import ChatRoutingPage from "./pages/chat/ChatRoutingPage";
import ChatInboxViewsPage from "./pages/chat/ChatInboxViewsPage";
import ChatReportsPage from "./pages/chat/ChatReportsPage";
import ChatAIAutoreplyPage from "./pages/chat/ChatAIAutoreplyPage";
import ChatIntegrationsPage from "./pages/chat/ChatIntegrationsPage";
import ChatTelephonyPage from "./pages/chat/ChatTelephonyPage";
import ChatMarketingAdvancedPage from "./pages/chat/ChatMarketingAdvancedPage";
import ChatComplianceCenterPage from "./pages/chat/ChatComplianceCenterPage";
import AdvboxIntegrationPage from "./pages/advbox/IntegrationPage";
import AdvboxNotificationRulesPage from "./pages/advbox/NotificationRulesPage";
import AdvboxProcessesPage from "./pages/advbox/ProcessesPage";
import AdvboxLogsPage from "./pages/advbox/LogsPage";
import AdvboxQueriesPage from "./pages/advbox/QueriesPage";
import MetaAdsTestPage from "./pages/admin/meta-ads/MetaAdsTestPage";
import MonitoramentoPage from "./pages/admin/monitoramento/MonitoramentoPage";
import OperacoesMonitorPage from "./pages/admin/operacoes/OperacoesMonitorPage";
import WebhookMonitorPage from "./pages/admin/webhook-monitor/WebhookMonitorPage";
import CopilotAdminPage from "./pages/admin/copiloto/CopilotAdminPage";
import DataJudSearchPage from "./pages/datajud/DataJudSearchPage";
import TelefoniaPage from "./pages/telefonia/TelefoniaPage";
import TelefoniaAdminPage from "./pages/admin/telefonia/TelefoniaAdminPage";
import RedirectPage from "./pages/RedirectPage";
import NotFound from "./pages/NotFound";
import PromptGeneratorPage from "./pages/admin/prompts/PromptGeneratorPage";
import EmbedPage from "./pages/embed/EmbedPage";
import EmbedManagerPage from "./pages/admin/embeds/EmbedManagerPage";
import TvMasterPage from "./pages/tv/TvMasterPage";
import ContratarTelefoniaPage from "./pages/telefonia/contratar/ContratarTelefoniaPage";
import LegalCasesPage from "./pages/legal-cases/LegalCasesPage";
import ContractNotificationsPage from "./pages/contract-notifications/ContractNotificationsPage";
import ComprarPage from "./pages/comprar/ComprarPage";
import ComprarSucessoPage from "./pages/comprar/ComprarSucessoPage";
import PedidosPage from "./pages/admin/pedidos/PedidosPage";
import PlanosPage from "./pages/admin/planos/PlanosPage";
import ContratoTemplatePage from "./pages/admin/contrato/ContratoTemplatePage";
import AdvDashboardPage from "./pages/adv/AdvDashboardPage";
import CRMComercialPage from "./pages/comercial/crm/CRMComercialPage";
import SupportAssistantPage from "./pages/suporte-assistente/SupportAssistantPage";
import QuickMessagesPage from "./pages/mensagens-rapidas/QuickMessagesPage";
import FilasPage from "./pages/agente/filas/FilasPage";
import ConfiguracoesPage from "./pages/configuracoes/ConfiguracoesPage";
import HumanSupportPage from "./pages/atendimento-humano/HumanSupportPage";
import PushNotificationsPage from "./pages/admin/push-notifications/PushNotificationsPage";
import ContatosPage from "./pages/contatos/ContatosPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <DebugProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UaZapiProvider>
              <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/redirect" element={<RedirectPage />} />
                <Route path="/comprar" element={<ComprarPage />} />
                <Route path="/comprar/sucesso" element={<ComprarSucessoPage />} />
                <Route path="/call/:roomName" element={<JoinCallPage />} />
                <Route path="/tv/master" element={<ProtectedRoute><TvMasterPage /></ProtectedRoute>} />
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/crm/leads" element={<ProtectedRoute module="crm_leads"><CRMPage /></ProtectedRoute>} />
                  <Route path="/crm/lead-estatisticas" element={<ProtectedRoute module="crm_statistics"><CRMStatisticsPage /></ProtectedRoute>} />
                  <Route path="/crm/lead-monitoramento" element={<ProtectedRoute module="crm_monitoring"><CRMMonitoringPage /></ProtectedRoute>} />
                  <Route path="/estrategico/desempenho" element={<ProtectedRoute module="strategic_perf"><DesempenhoPage /></ProtectedRoute>} />
                  <Route path="/estrategico/contratos" element={<ProtectedRoute module="strategic_contract"><ContratosPage /></ProtectedRoute>} />
                  <Route path="/estrategico/campanhas" element={<ProtectedRoute module="strategic_perf"><CampanhasPage /></ProtectedRoute>} />
                  <Route path="/agente/meus-agentes" element={<ProtectedRoute module="agent_management"><MyAgentsPage /></ProtectedRoute>} />
                  <Route path="/agente/meus-agentes/:codAgent/editar" element={<ProtectedRoute module="agent_management"><MyAgentEditPage /></ProtectedRoute>} />
                  <Route path="/agente/filas" element={<ProtectedRoute module="filas"><FilasPage /></ProtectedRoute>} />
                  <Route path="/configuracoes" element={<ProtectedRoute module="configuracoes"><ConfiguracoesPage /></ProtectedRoute>} />
                  <Route path="/agente/followup" element={<ProtectedRoute module="followup"><FollowupPage /></ProtectedRoute>} />
                  <Route path="/video/queue" element={<VideoQueuePage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/chat/canais" element={<ChatChannelsPage />} />
                  <Route path="/chat/metricas" element={<ChatMetricsPage />} />
                  <Route path="/chat/automacoes" element={<ChatAutomationsPage />} />
                  <Route path="/chat/webhooks" element={<ChatWebhooksPage />} />
                  <Route path="/chat/sla" element={<ChatSlaConfigPage />} />
                  <Route path="/chat/configuracoes" element={<ChatSettingsPage />} />
                  <Route path="/chat/api-keys" element={<ChatApiKeysPage />} />
                  <Route path="/chat/kb" element={<ChatKnowledgeBasePage />} />
                  <Route path="/chat/csat" element={<ChatCsatPage />} />
                  <Route path="/chat/bots" element={<ChatBotsPage />} />
                  <Route path="/chat/campanhas" element={<ChatCampaignsPage />} />
                  <Route path="/chat/builder" element={<ChatBotBuilderPage />} />
                  <Route path="/chat/roteamento" element={<ChatRoutingPage />} />
                  <Route path="/chat/visoes" element={<ChatInboxViewsPage />} />
                  <Route path="/chat/relatorios" element={<ChatReportsPage />} />
                  <Route path="/chat/ia-autoresposta" element={<ChatAIAutoreplyPage />} />
                  <Route path="/chat/integracoes" element={<ChatIntegrationsPage />} />
                  <Route path="/chat/telefonia" element={<ChatTelephonyPage />} />
                  <Route path="/chat/marketing" element={<ChatMarketingAdvancedPage />} />
                  <Route path="/chat/compliance" element={<ChatComplianceCenterPage />} />
                  <Route path="/biblioteca" element={<ProtectedRoute module="library"><CriativosPage /></ProtectedRoute>} />
                  <Route path="/equipe" element={<ProtectedRoute module="team"><EquipePage /></ProtectedRoute>} />
                  <Route path="/perfil" element={<ProfileSettingsPage />} />
                  <Route path="/advbox" element={<AdvboxIntegrationPage />} />
                  <Route path="/advbox/regras" element={<AdvboxNotificationRulesPage />} />
                  <Route path="/advbox/processos" element={<AdvboxProcessesPage />} />
                  <Route path="/advbox/logs" element={<AdvboxLogsPage />} />
                  <Route path="/advbox/consultas" element={<AdvboxQueriesPage />} />
                  <Route path="/crm-builder" element={<ProtectedRoute module="crm_leads"><CRMBuilderPage /></ProtectedRoute>} />
                  <Route path="/crm-builder/:boardId" element={<ProtectedRoute module="crm_leads"><BoardPage /></ProtectedRoute>} />
                  <Route path="/datajud" element={<ProtectedRoute module="datajud"><DataJudSearchPage /></ProtectedRoute>} />
                  <Route path="/casos-juridicos" element={<ProtectedRoute module="legal_cases"><LegalCasesPage /></ProtectedRoute>} />
                  <Route path="/notificacoes-contrato" element={<ProtectedRoute module="contract_notifications"><ContractNotificationsPage /></ProtectedRoute>} />
                  <Route path="/telefonia" element={<ProtectedRoute module="telephony"><TelefoniaPage /></ProtectedRoute>} />
                  <Route path="/comercial/crm" element={<ProtectedRoute module="crm_comercial"><CRMComercialPage /></ProtectedRoute>} />
                  <Route path="/suporte-assistente" element={<ProtectedRoute module="support_assistant"><SupportAssistantPage /></ProtectedRoute>} />
                  <Route path="/mensagens-rapidas" element={<ProtectedRoute module="quick_messages"><QuickMessagesPage /></ProtectedRoute>} />
                  <Route path="/atendimento-humano" element={<ProtectedRoute module="human_support"><HumanSupportPage /></ProtectedRoute>} />
                  <Route path="/contatos" element={<ProtectedRoute module="contacts"><ContatosPage /></ProtectedRoute>} />
                  
                  {/* Admin routes - protected by module permission */}
                  <Route path="/admin/agentes" element={<ProtectedRoute module="admin_agents"><AgentsList /></ProtectedRoute>} />
                  <Route path="/admin/agentes-novo" element={<ProtectedRoute module="admin_agents"><CreateAgentPage /></ProtectedRoute>} />
                  <Route path="/admin/agentes/:id/editar" element={<ProtectedRoute module="admin_agents"><EditAgentPage /></ProtectedRoute>} />
                  <Route path="/admin/agentes/:id/detalhes" element={<ProtectedRoute module="admin_agents"><AgentDetailsPage /></ProtectedRoute>} />
                  <Route path="/admin/modulos" element={<ProtectedRoute module="admin_agents"><ModulosPage /></ProtectedRoute>} />
                  <Route path="/admin/permissoes" element={<ProtectedRoute module="admin_agents"><PermissoesPage /></ProtectedRoute>} />
                  <Route path="/admin/meta-test" element={<ProtectedRoute module="admin_agents"><MetaTestPage /></ProtectedRoute>} />
                  <Route path="/admin/meta-ads" element={<ProtectedRoute module="admin_agents"><MetaAdsTestPage /></ProtectedRoute>} />
                  <Route path="/admin/monitoramento" element={<ProtectedRoute module="admin_agents"><MonitoramentoPage /></ProtectedRoute>} />
                  <Route path="/admin/operacoes" element={<ProtectedRoute module="admin_agents"><OperacoesMonitorPage /></ProtectedRoute>} />
                  <Route path="/admin/copiloto" element={<ProtectedRoute module="copilot_admin"><CopilotAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/telefonia" element={<ProtectedRoute module="telephony_admin"><TelefoniaAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/webhook-monitor" element={<ProtectedRoute module="admin_agents"><WebhookMonitorPage /></ProtectedRoute>} />
                  <Route path="/admin/prompts" element={<ProtectedRoute module="prompt_generator"><PromptGeneratorPage /></ProtectedRoute>} />
                  <Route path="/admin/pedidos" element={<ProtectedRoute module="julia_orders"><PedidosPage /></ProtectedRoute>} />
                  <Route path="/admin/planos" element={<ProtectedRoute module="julia_plans"><PlanosPage /></ProtectedRoute>} />
                  <Route path="/admin/contrato-template" element={<ProtectedRoute module="admin_agents"><ContratoTemplatePage /></ProtectedRoute>} />
                  <Route path="/admin/notificacoes-push" element={<ProtectedRoute module="push_notifications"><PushNotificationsPage /></ProtectedRoute>} />
                  <Route path="/admin/embeds" element={<ProtectedRoute module="admin_embeds"><EmbedManagerPage /></ProtectedRoute>} />
                  <Route path="/sys/:code" element={<ProtectedRoute><EmbedPage /></ProtectedRoute>} />
                  <Route path="/telefonia/contratar" element={<ProtectedRoute><ContratarTelefoniaPage /></ProtectedRoute>} />
                </Route>
                {/* Advogado routes - mobile layout */}
                <Route element={<AdvLayout />}>
                  <Route path="/adv/dashboard" element={<ProtectedRoute module="adv_dashboard" fallbackPath="/login"><AdvDashboardPage /></ProtectedRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </ErrorBoundary>
              <DebugBar />
            </UaZapiProvider>
          </AuthProvider>
        </BrowserRouter>
      </DebugProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
