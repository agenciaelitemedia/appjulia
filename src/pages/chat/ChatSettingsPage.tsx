import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, Settings, Timer, Tag as TagIcon, Cog } from 'lucide-react';
import { TagsManagerContent } from '@/components/chat/TagsManagerDialog';
import { ChatSlaConfigContent } from './ChatSlaConfigPage';
import { WhatsAppDataProvider } from '@/contexts/WhatsAppDataContext';

function ChatSettingsContent() {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
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
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="geral" className="gap-1.5">
            <Cog className="h-3.5 w-3.5" /> Geral
          </TabsTrigger>
          <TabsTrigger value="sla" className="gap-1.5">
            <Timer className="h-3.5 w-3.5" /> SLA
          </TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-1.5">
            <TagIcon className="h-3.5 w-3.5" /> Etiquetas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6">
          <div className="text-sm text-muted-foreground py-12 text-center border rounded-lg">
            Configurações gerais do chat em breve.
          </div>
        </TabsContent>

        <TabsContent value="sla" className="mt-6">
          <ChatSlaConfigContent />
        </TabsContent>

        <TabsContent value="etiquetas" className="mt-6">
          <div className="max-w-xl">
            <TagsManagerContent />
          </div>
        </TabsContent>
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