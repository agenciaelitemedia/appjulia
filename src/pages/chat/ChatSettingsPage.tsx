import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Settings, Timer, Tag as TagIcon, Cog, Radio, Zap, Activity, FileText, GitFork } from 'lucide-react';
import { TagsManagerContent } from '@/components/chat/TagsManagerDialog';
import { ChatSlaConfigContent } from './ChatSlaConfigPage';
import { WhatsAppDataProvider } from '@/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import ChatChannelsPage from './ChatChannelsPage';
import ChatAutomationsPage from './ChatAutomationsPage';
import { ChatGeneralSettings } from './components/ChatGeneralSettings';
import { ChatReturnChatMonitor } from './components/ChatReturnChatMonitor';
import { WabaTemplatesPanel } from './waba-templates/WabaTemplatesPanel';
import { ChatAutoDistributionTab } from './components/ChatAutoDistributionTab';

function ChatSettingsContent() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  return (
    <div className="p-6 space-y-6 w-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/chat')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" /> Configurações do Chat
          </h2>
          <p className="text-muted-foreground text-sm">
            Geral, SLA e Etiquetas do módulo de atendimento
          </p>
        </div>
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className={`grid w-full ${isAdmin ? 'max-w-6xl grid-cols-8' : 'max-w-2xl grid-cols-4'}`}>
          <TabsTrigger value="geral" className="gap-1.5">
            <Cog className="h-3.5 w-3.5" /> Geral
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5">
            <Timer className="h-3.5 w-3.5" /> SLA
          </TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-1.5">
            <TagIcon className="h-3.5 w-3.5" /> Etiquetas
          </TabsTrigger>
          <TabsTrigger value="distribuicao" className="gap-1.5">
            <GitFork className="h-3.5 w-3.5" /> Distribuição Automática
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="monitor" className="gap-1.5">
              <Activity className="h-3.5 w-3.5" /> Monitor
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="canais" className="gap-1.5">
              <Radio className="h-3.5 w-3.5" /> Canais
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="automacoes" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Automações
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="waba-templates" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Templates WABA
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <ChatGeneralSettings />
        </TabsContent>

        <TabsContent value="sla" className="mt-6">
          <ChatSlaConfigContent />
        </TabsContent>

        <TabsContent value="etiquetas" className="mt-6">
          <TagsManagerContent />
        </TabsContent>

        <TabsContent value="distribuicao" className="mt-6">
          <ChatAutoDistributionTab />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="monitor" className="mt-6">
            <ChatReturnChatMonitor />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="canais" className="mt-6">
            <ChatChannelsPage embedded />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="automacoes" className="mt-6">
            <ChatAutomationsPage embedded />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="waba-templates" className="mt-6">
            <WabaTemplatesPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function ChatSettingsPage() {
  return (
    <WhatsAppDataProvider>
      <ChatSettingsContent />
    </WhatsAppDataProvider>
  );
}