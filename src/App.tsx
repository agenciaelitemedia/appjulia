import { Toaster } from "@/components/ui/toaster";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UaZapiProvider } from "@/contexts/UaZapiContext";
import { DebugProvider } from "@/contexts/DebugContext";
import { MainLayout } from "@/components/layout/MainLayout";

import { ProtectedRoute } from "@/components/guards/ProtectedRoute";
import { DebugBar } from "@/components/debug/DebugBar";

// ── Static imports (critical path / tiny) ──────────────────────
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import RedirectPage from "./pages/RedirectPage";
import ComprarPage from "./pages/comprar/ComprarPage";
import ComprarSucessoPage from "./pages/comprar/ComprarSucessoPage";
import JoinCallPage from "./pages/video/JoinCallPage";

// ── Lazy imports (code-split per route) ────────────────────────
const CRMPage = lazy(() => import("./pages/crm/CRMPage"));
const CRMStatisticsPage = lazy(() => import("./pages/crm/statistics/CRMStatisticsPage"));
const CRMMonitoringPage = lazy(() => import("./pages/crm/monitoring/CRMMonitoringPage"));
const CRMBuilderPage = lazy(() => import("./pages/crm-builder/CRMBuilderPage"));
const BoardPage = lazy(() => import("./pages/crm-builder/BoardPage"));
const AgentsList = lazy(() => import("./pages/agents/AgentsList"));
const CreateAgentPage = lazy(() => import("./pages/agents/CreateAgentPage"));
const AgentDetailsPage = lazy(() => import("./pages/agents/AgentDetailsPage"));
const EditAgentPage = lazy(() => import("./pages/agents/EditAgentPage"));
const DesempenhoPage = lazy(() => import("./pages/estrategico/desempenho/DesempenhoPage"));
const ContratosPage = lazy(() => import("./pages/estrategico/contratos/ContratosPage"));
const CampanhasPage = lazy(() => import("./pages/estrategico/campanhas/CampanhasPage"));
const FollowupPage = lazy(() => import("./pages/agente/followup/FollowupPage"));
const MyAgentsPage = lazy(() => import("./pages/agente/meus-agentes/MyAgentsPage"));
const MyAgentEditPage = lazy(() => import("./pages/agente/meus-agentes/MyAgentEditPage"));
const CriativosPage = lazy(() => import("./pages/criativos/CriativosPage"));
const EquipePage = lazy(() => import("./pages/equipe/EquipePage"));
const ProfileSettingsPage = lazy(() => import("./pages/profile/ProfileSettingsPage"));
const PermissoesPage = lazy(() => import("./pages/admin/permissoes/PermissoesPage"));
const MetaTestPage = lazy(() => import("./pages/admin/meta-test/MetaTestPage"));
const ModulosPage = lazy(() => import("./pages/admin/modulos/ModulosPage"));
const VideoQueuePage = lazy(() => import("./pages/video/VideoQueuePage"));
const ChatPage = lazy(() => import("./pages/chat/ChatPage"));
const ChatChannelsPage = lazy(() => import("./pages/chat/ChatChannelsPage"));
const ChatMetricsPage = lazy(() => import("./pages/chat/ChatMetricsPage"));
const ChatAutomationsPage = lazy(() => import("./pages/chat/ChatAutomationsPage"));
const ChatWebhooksPage = lazy(() => import("./pages/chat/ChatWebhooksPage"));
const ChatSlaConfigPage = lazy(() => import("./pages/chat/ChatSlaConfigPage"));
const ChatSettingsPage = lazy(() => import("./pages/chat/ChatSettingsPage"));
const ChatApiKeysPage = lazy(() => import("./pages/chat/ChatApiKeysPage"));
const ChatKnowledgeBasePage = lazy(() => import("./pages/chat/ChatKnowledgeBasePage"));
const ChatCsatPage = lazy(() => import("./pages/chat/ChatCsatPage"));
const ChatBotsPage = lazy(() => import("./pages/chat/ChatBotsPage"));
const ChatCampaignsPage = lazy(() => import("./pages/chat/ChatCampaignsPage"));
const ChatBotBuilderPage = lazy(() => import("./pages/chat/ChatBotBuilderPage"));
const ChatRoutingPage = lazy(() => import("./pages/chat/ChatRoutingPage"));
const ChatInboxViewsPage = lazy(() => import("./pages/chat/ChatInboxViewsPage"));
const ChatReportsPage = lazy(() => import("./pages/chat/ChatReportsPage"));
const ChatAIAutoreplyPage = lazy(() => import("./pages/chat/ChatAIAutoreplyPage"));
const ChatIntegrationsPage = lazy(() => import("./pages/chat/ChatIntegrationsPage"));
const ChatTelephonyPage = lazy(() => import("./pages/chat/ChatTelephonyPage"));
const ChatMarketingAdvancedPage = lazy(() => import("./pages/chat/ChatMarketingAdvancedPage"));
const ChatComplianceCenterPage = lazy(() => import("./pages/chat/ChatComplianceCenterPage"));
const AdvboxIntegrationPage = lazy(() => import("./pages/advbox/IntegrationPage"));
const AdvboxNotificationRulesPage = lazy(() => import("./pages/advbox/NotificationRulesPage"));
const AdvboxProcessesPage = lazy(() => import("./pages/advbox/ProcessesPage"));
const AdvboxLogsPage = lazy(() => import("./pages/advbox/LogsPage"));
const AdvboxQueriesPage = lazy(() => import("./pages/advbox/QueriesPage"));
const MetaAdsTestPage = lazy(() => import("./pages/admin/meta-ads/MetaAdsTestPage"));
const MonitoramentoPage = lazy(() => import("./pages/admin/monitoramento/MonitoramentoPage"));
const OperacoesMonitorPage = lazy(() => import("./pages/admin/operacoes/OperacoesMonitorPage"));
const WebhookMonitorPage = lazy(() => import("./pages/admin/webhook-monitor/WebhookMonitorPage"));
const CopilotAdminPage = lazy(() => import("./pages/admin/copiloto/CopilotAdminPage"));
const DataJudSearchPage = lazy(() => import("./pages/datajud/DataJudSearchPage"));
const TelefoniaPage = lazy(() => import("./pages/telefonia/TelefoniaPage"));
const TelefoniaAdminPage = lazy(() => import("./pages/admin/telefonia/TelefoniaAdminPage"));
const ChatAdminPage = lazy(() => import("./pages/admin/chat/ChatAdminPage"));
const PromptGeneratorPage = lazy(() => import("./pages/admin/prompts/PromptGeneratorPage"));
const EmbedPage = lazy(() => import("./pages/embed/EmbedPage"));
const EmbedManagerPage = lazy(() => import("./pages/admin/embeds/EmbedManagerPage"));
const TvMasterPage = lazy(() => import("./pages/tv/TvMasterPage"));
const ContratarTelefoniaPage = lazy(() => import("./pages/telefonia/contratar/ContratarTelefoniaPage"));
const ContratarFilasPage = lazy(() => import("./pages/filas/contratar/ContratarFilasPage"));
const ContratarVideoPage = lazy(() => import("./pages/video/contratar/ContratarVideoPage"));
const VideoAdminPage = lazy(() => import("./pages/admin/video/VideoAdminPage"));
const LegalCasesPage = lazy(() => import("./pages/legal-cases/LegalCasesPage"));
const ContractNotificationsPage = lazy(() => import("./pages/contract-notifications/ContractNotificationsPage"));
const PedidosPage = lazy(() => import("./pages/admin/pedidos/PedidosPage"));
const PlanosPage = lazy(() => import("./pages/admin/planos/PlanosPage"));
const ContratoTemplatePage = lazy(() => import("./pages/admin/contrato/ContratoTemplatePage"));
const CRMComercialPage = lazy(() => import("./pages/comercial/crm/CRMComercialPage"));
const SupportAssistantPage = lazy(() => import("./pages/suporte-assistente/SupportAssistantPage"));
const QuickMessagesPage = lazy(() => import("./pages/mensagens-rapidas/QuickMessagesPage"));
const FilasPage = lazy(() => import("./pages/agente/filas/FilasPage"));
const ConfiguracoesPage = lazy(() => import("./pages/configuracoes/ConfiguracoesPage"));
const HumanSupportPage = lazy(() => import("./pages/atendimento-humano/HumanSupportPage"));
const PushNotificationsPage = lazy(() => import("./pages/admin/push-notifications/PushNotificationsPage"));
const ContatosPage = lazy(() => import("./pages/contatos/ContatosPage"));
const TasksPage = lazy(() => import("./pages/tarefas/TasksPage"));
const NotifyCustomersPage = lazy(() => import("./pages/notify-customers/NotifyCustomersPage"));
const TicketsPage = lazy(() => import("./pages/tickets/TicketsPage"));
const TicketDetailPage = lazy(() => import("./pages/tickets/TicketDetailPage"));
const HelpCenterPage = lazy(() => import("./pages/ajuda/HelpCenterPage"));
const HelpPostPage = lazy(() => import("./pages/ajuda/HelpPostPage"));
const HelpStudioPage = lazy(() => import("./pages/ajuda/studio/HelpStudioPage"));
const HelpPostEditorPage = lazy(() => import("./pages/ajuda/studio/HelpPostEditorPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,         // 30s — evita refetch desnecessário ao trocar de aba
      refetchOnWindowFocus: false, // elimina storm de queries ao focar a janela
    },
  },
});

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
              <Suspense fallback={null}>
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
                  <Route path="/tarefas" element={<ProtectedRoute module="tasks"><TasksPage /></ProtectedRoute>} />
                  <Route path="/notificar-clientes" element={<ProtectedRoute module="notify_customers"><NotifyCustomersPage /></ProtectedRoute>} />
                  <Route path="/tickets" element={<ProtectedRoute module="support_tickets"><TicketsPage /></ProtectedRoute>} />
                  <Route path="/tickets/:id" element={<ProtectedRoute module="support_tickets"><TicketDetailPage /></ProtectedRoute>} />
                  <Route path="/ajuda" element={<ProtectedRoute module="help_center"><HelpCenterPage /></ProtectedRoute>} />
                  <Route path="/ajuda/post/:slug" element={<ProtectedRoute module="help_center"><HelpPostPage /></ProtectedRoute>} />
                  <Route path="/ajuda/studio" element={<ProtectedRoute module="help_center"><HelpStudioGuard><HelpStudioPage /></HelpStudioGuard></ProtectedRoute>} />
                  <Route path="/ajuda/studio/post/:id" element={<ProtectedRoute module="help_center"><HelpStudioGuard><HelpPostEditorPage /></HelpStudioGuard></ProtectedRoute>} />
                  
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
                  <Route path="/admin/chat" element={<ProtectedRoute module="chat_admin"><ChatAdminPage /></ProtectedRoute>} />
                  <Route path="/admin/webhook-monitor" element={<ProtectedRoute module="admin_agents"><WebhookMonitorPage /></ProtectedRoute>} />
                  <Route path="/admin/prompts" element={<ProtectedRoute module="prompt_generator"><PromptGeneratorPage /></ProtectedRoute>} />
                  <Route path="/admin/pedidos" element={<ProtectedRoute module="julia_orders"><PedidosPage /></ProtectedRoute>} />
                  <Route path="/admin/planos" element={<ProtectedRoute module="julia_plans"><PlanosPage /></ProtectedRoute>} />
                  <Route path="/admin/contrato-template" element={<ProtectedRoute module="admin_agents"><ContratoTemplatePage /></ProtectedRoute>} />
                  <Route path="/admin/notificacoes-push" element={<ProtectedRoute module="push_notifications"><PushNotificationsPage /></ProtectedRoute>} />
                  <Route path="/admin/embeds" element={<ProtectedRoute module="admin_embeds"><EmbedManagerPage /></ProtectedRoute>} />
                  <Route path="/sys/:code" element={<ProtectedRoute><EmbedPage /></ProtectedRoute>} />
                  <Route path="/telefonia/contratar" element={<ProtectedRoute><ContratarTelefoniaPage /></ProtectedRoute>} />
                  <Route path="/filas/contratar" element={<ProtectedRoute><ContratarFilasPage /></ProtectedRoute>} />
                  <Route path="/video/contratar" element={<ProtectedRoute><ContratarVideoPage /></ProtectedRoute>} />
                  <Route path="/admin/video" element={<ProtectedRoute module="admin_agents"><VideoAdminPage /></ProtectedRoute>} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              </Suspense>
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
