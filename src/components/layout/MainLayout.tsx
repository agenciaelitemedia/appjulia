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

function GlobalSoftphone() {
  const { sip, showSoftphone, setShowSoftphone, softphoneCentered, setSoftphoneCentered, dialContactName, isDialing, dialError, clearDialError, retryDial, cancelDial } = usePhone();

  if (!showSoftphone && !isDialing && !dialError) return null;

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
  const { isAuthenticated, isLoading } = useAuth();

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
        </div>
      </SidebarProvider>
    </PhoneProvider>
  );
}
