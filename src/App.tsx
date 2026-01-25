import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UaZapiProvider } from "@/contexts/UaZapiContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { AdminRoute } from "@/components/guards/AdminRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CRMPage from "./pages/crm/CRMPage";
import CRMStatisticsPage from "./pages/crm/statistics/CRMStatisticsPage";
import CRMMonitoringPage from "./pages/crm/monitoring/CRMMonitoringPage";
import AgentsList from "./pages/agents/AgentsList";
import CreateAgentPage from "./pages/agents/CreateAgentPage";
import DesempenhoPage from "./pages/estrategico/desempenho/DesempenhoPage";
import ContratosPage from "./pages/estrategico/contratos/ContratosPage";
import FollowupPage from "./pages/agente/followup/FollowupPage";
import CriativosPage from "./pages/criativos/CriativosPage";
import ProfileSettingsPage from "./pages/profile/ProfileSettingsPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <UaZapiProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<MainLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/crm/leads" element={<CRMPage />} />
                <Route path="/crm/lead-estatisticas" element={<CRMStatisticsPage />} />
                <Route path="/crm/lead-monitoramento" element={<CRMMonitoringPage />} />
                <Route path="/estrategico/desempenho" element={<DesempenhoPage />} />
                <Route path="/estrategico/contratos" element={<ContratosPage />} />
                <Route path="/agente/followup" element={<FollowupPage />} />
                <Route path="/criativos" element={<CriativosPage />} />
                <Route path="/perfil" element={<ProfileSettingsPage />} />
                
                {/* Admin-only routes */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin/agentes" element={<AgentsList />} />
                  <Route path="/admin/agentes-novo" element={<CreateAgentPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </UaZapiProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
