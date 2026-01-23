import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { UaZapiProvider } from "@/contexts/UaZapiContext";
import { MainLayout } from "@/components/layout/MainLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CRMPage from "./pages/crm/CRMPage";
import CRMStatisticsPage from "./pages/crm/statistics/CRMStatisticsPage";
import CRMMonitoringPage from "./pages/crm/monitoring/CRMMonitoringPage";
import AgentsList from "./pages/agents/AgentsList";
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
                <Route path="/admin/agentes" element={<AgentsList />} />
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
