import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '@/contexts/AuthContext';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { PhoneProvider, usePhone } from '@/contexts/PhoneContext';
import { CopilotWidget } from '@/components/copilot/CopilotWidget';
import { SoftphoneWidget } from '@/pages/telefonia/components/SoftphoneWidget';
import { cn } from '@/lib/utils';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';
import { AgentBlockedScreen } from './AgentBlockedScreen';
import { DisconnectedAgentsAlert } from './DisconnectedAgentsAlert';
import { DisconnectedQueuesAlert } from './DisconnectedQueuesAlert';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useGlobalPresence } from '@/hooks/useGlobalPresence';
import { useHeartbeat } from '@/hooks/useHeartbeat';
import { usePerformanceReporter } from '@/hooks/usePerformanceReporter';
import { useNewMessageSound } from '@/hooks/useNewMessageSound';

function GlobalSoftphone() {
  const { sip, showSoftphone, setShowSoftphone, softphoneCentered, setSoftphoneCentered, dialContactName, isDialing, dialError, clearDialError, retryDial, cancelDial } = usePhone();

  const sipActive = ['ringing', 'calling', 'in-call'].includes(sip.status);
  if (!showSoftphone && !isDialing && !dialError && !sipActive) return null;

  return (
    <SoftphoneWidget
      status={sip.status}
      duration={sip.duration}
      isMuted={sip.isMuted}
      isHeld={sip.isHeld}
      callerInfo={sip.callerInfo || dialContactName}
      onAnswer={sip.answer}
      onHangup={sip.hangup}
      onToggleMute={sip.toggleMute}
      onToggleHold={sip.toggleHold}
      onSendDTMF={sip.sendDTMF}
      centered={softphoneCentered}
      isDialing={isDialing}
      dialError={dialError}
      onRetry={retryDial}
      onDismissError={clearDialError}
      onCancel={cancelDial}
      onCallFinished={() => {
        setShowSoftphone(false);
        setSoftphoneCentered(false);
      }}
    />
  );
}

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { isAuthenticated, isLoading, isAdmin, user } = useAuth();
  const { data: agentsData, isLoading: agentsLoading } = useMyAgents();

  // Anuncia presença global para o dashboard de equipe
  useGlobalPresence();
  useHeartbeat();
  // Telemetria de performance (Web Vitals + tempos de carga)
  usePerformanceReporter();
  // Alerta sonoro global de novas mensagens do Chat (toca em qualquer página)
  useNewMessageSound();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if non-admin user has all agents inactive
  if (!isAdmin && !agentsLoading && agentsData) {
    const allAgents = [...agentsData.myAgents, ...agentsData.monitoredAgents];
    if (allAgents.length > 0 && !allAgents.some(a => a.status === true)) {
      return <AgentBlockedScreen />;
    }
    if (allAgents.length === 0 && user?.cod_agent) {
      return <AgentBlockedScreen />;
    }
  }

  return (
    <PhoneProvider>
      <SidebarProvider isCollapsed={sidebarCollapsed}>
        <div className="min-h-screen bg-background">
          <Sidebar 
            isOpen={sidebarOpen} 
            onToggle={() => setSidebarOpen(!sidebarOpen)}
            isCollapsed={sidebarCollapsed}
            onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
          
          <div className={cn(
            "transition-all duration-300",
            sidebarCollapsed ? "lg:ml-16" : "lg:ml-64"
          )}>
            <Header 
              onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
              isCollapsed={sidebarCollapsed}
              onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            
            <main className="p-4 lg:p-6">
              <Outlet />
            </main>
          </div>
          <GlobalSoftphone />
          <CopilotWidget />
          <DisconnectedAgentsAlert />
          <DisconnectedQueuesAlert />
          <NotificationCenter />
        </div>
      </SidebarProvider>
    </PhoneProvider>
  );
}
