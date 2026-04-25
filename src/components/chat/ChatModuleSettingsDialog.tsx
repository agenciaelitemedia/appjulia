import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings, Timer, Tag as TagIcon, Cog } from 'lucide-react';
import { TagsManagerContent } from './TagsManagerDialog';
import { ChatSlaConfigContent } from '@/pages/chat/ChatSlaConfigPage';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ChatModuleSettingsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" /> Configurações do Chat
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="geral" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
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

          <div className="flex-1 overflow-y-auto pt-4">
            <TabsContent value="geral" className="m-0">
              <div className="text-sm text-muted-foreground py-8 text-center">
                Configurações gerais do chat em breve.
              </div>
            </TabsContent>

            <TabsContent value="sla" className="m-0">
              <ChatSlaConfigContent />
            </TabsContent>

            <TabsContent value="etiquetas" className="m-0">
              <TagsManagerContent />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}