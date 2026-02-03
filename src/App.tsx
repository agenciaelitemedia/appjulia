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
import { AdminRoute } from "@/components/guards/AdminRoute";
import { DebugBar } from "@/components/debug/DebugBar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CRMPage from "./pages/crm/CRMPage";
import CRMStatisticsPage from "./pages/crm/statistics/CRMStatisticsPage";
import CRMMonitoringPage from "./pages/crm/monitoring/CRMMonitoringPage";
import AgentsList from "./pages/agents/AgentsList";
import CreateAgentPage from "./pages/agents/CreateAgentPage";
import AgentDetailsPage from "./pages/agents/AgentDetailsPage";
import EditAgentPage from "./pages/agents/EditAgentPage";
import DesempenhoPage from "./pages/estrategico/desempenho/DesempenhoPage";
import ContratosPage from "./pages/estrategico/contratos/ContratosPage";
import FollowupPage from "./pages/agente/followup/FollowupPage";
import MyAgentsPage from "./pages/agente/meus-agentes/MyAgentsPage";
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
                <Route path="/call/:roomName" element={<JoinCallPage />} />
                <Route element={<MainLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/crm/leads" element={<CRMPage />} />
                  <Route path="/crm/lead-estatisticas" element={<CRMStatisticsPage />} />
                  <Route path="/crm/lead-monitoramento" element={<CRMMonitoringPage />} />
                  <Route path="/estrategico/desempenho" element={<DesempenhoPage />} />
                  <Route path="/estrategico/contratos" element={<ContratosPage />} />
                  <Route path="/agente/meus-agentes" element={<MyAgentsPage />} />
                  <Route path="/agente/followup" element={<FollowupPage />} />
                  <Route path="/video/queue" element={<VideoQueuePage />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/biblioteca" element={<CriativosPage />} />
                  <Route path="/equipe" element={<EquipePage />} />
                  <Route path="/perfil" element={<ProfileSettingsPage />} />
                  <Route path="/advbox" element={<AdvboxIntegrationPage />} />
                  <Route path="/advbox/regras" element={<AdvboxNotificationRulesPage />} />
                  
                  {/* Admin-only routes */}
                  <Route element={<AdminRoute />}>
                    <Route path="/admin/agentes" element={<AgentsList />} />
                    <Route path="/admin/agentes-novo" element={<CreateAgentPage />} />
                    <Route path="/admin/agentes/:id/editar" element={<EditAgentPage />} />
                    <Route path="/admin/agentes/:id/detalhes" element={<AgentDetailsPage />} />
                    <Route path="/admin/modulos" element={<ModulosPage />} />
                    <Route path="/admin/permissoes" element={<PermissoesPage />} />
                    <Route path="/admin/meta-test" element={<MetaTestPage />} />
                  </Route>
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
