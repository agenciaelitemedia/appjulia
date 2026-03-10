import { Toaster } from "@/components/ui/toaster";
import { lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UaZapiProvider } from "@/contexts/UaZapiContext";
import { DebugProvider } from "@/contexts/DebugContext";
import { MainLayout } from "@/components/layout/MainLayout";
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
import AdvboxIntegrationPage from "./pages/advbox/IntegrationPage";
import AdvboxNotificationRulesPage from "./pages/advbox/NotificationRulesPage";
import AdvboxProcessesPage from "./pages/advbox/ProcessesPage";
import AdvboxLogsPage from "./pages/advbox/LogsPage";
import AdvboxQueriesPage from "./pages/advbox/QueriesPage";
import MetaAdsTestPage from "./pages/admin/meta-ads/MetaAdsTestPage";
import MonitoramentoPage from "./pages/admin/monitoramento/MonitoramentoPage";
import DataJudSearchPage from "./pages/datajud/DataJudSearchPage";
import RedirectPage from "./pages/RedirectPage";
import NotFound from "./pages/NotFound";

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
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/redirect" element={<RedirectPage />} />
                <Route path="/call/:roomName" element={<JoinCallPage />} />
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/crm/leads" element={<CRMPage />} />
                  <Route path="/crm/lead-estatisticas" element={<CRMStatisticsPage />} />
                  <Route path="/crm/lead-monitoramento" element={<CRMMonitoringPage />} />
                  <Route path="/estrategico/desempenho" element={<DesempenhoPage />} />
                  <Route path="/estrategico/contratos" element={<ContratosPage />} />
                  <Route path="/estrategico/campanhas" element={<CampanhasPage />} />
                  <Route path="/agente/meus-agentes" element={<MyAgentsPage />} />
                  <Route path="/agente/meus-agentes/:codAgent/editar" element={<MyAgentEditPage />} />
                  <Route path="/agente/followup" element={<FollowupPage />} />
                  <Route path="/video/queue" element={<VideoQueuePage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/biblioteca" element={<CriativosPage />} />
                  <Route path="/equipe" element={<EquipePage />} />
                  <Route path="/perfil" element={<ProfileSettingsPage />} />
                  <Route path="/advbox" element={<AdvboxIntegrationPage />} />
                  <Route path="/advbox/regras" element={<AdvboxNotificationRulesPage />} />
                  <Route path="/advbox/processos" element={<AdvboxProcessesPage />} />
                  <Route path="/advbox/logs" element={<AdvboxLogsPage />} />
                  <Route path="/advbox/consultas" element={<AdvboxQueriesPage />} />
                  <Route path="/crm-builder" element={<CRMBuilderPage />} />
                  <Route path="/crm-builder/:boardId" element={<BoardPage />} />
                  <Route path="/datajud" element={<DataJudSearchPage />} />
                  
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
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
              <DebugBar />
            </UaZapiProvider>
          </AuthProvider>
        </BrowserRouter>
      </DebugProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
