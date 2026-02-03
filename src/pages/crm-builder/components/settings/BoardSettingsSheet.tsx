import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Layers, Zap, BarChart3 } from 'lucide-react';
import { CustomFieldsManager } from '../custom-fields/CustomFieldsManager';
import { AutomationsManager } from '../automations/AutomationsManager';
import { BoardAnalyticsDashboard } from '../analytics/BoardAnalyticsDashboard';
import type { CRMPipeline, CRMDeal } from '../../types';

interface BoardSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  codAgent: string;
  boardName: string;
  pipelines: CRMPipeline[];
  deals: CRMDeal[];
}

export function BoardSettingsSheet({
  open,
  onOpenChange,
  boardId,
  codAgent,
  boardName,
  pipelines,
  deals,
}: BoardSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Configurações: {boardName}
          </SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="analytics" className="mt-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analytics" className="gap-1 text-xs px-2">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="custom-fields" className="gap-1 text-xs px-2">
              <Layers className="h-3.5 w-3.5" />
              Campos
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-1 text-xs px-2">
              <Zap className="h-3.5 w-3.5" />
              Automações
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-1 text-xs px-2">
              <Settings2 className="h-3.5 w-3.5" />
              Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-4">
            <BoardAnalyticsDashboard deals={deals} pipelines={pipelines} />
          </TabsContent>

          <TabsContent value="custom-fields" className="mt-4">
            <CustomFieldsManager boardId={boardId} codAgent={codAgent} />
          </TabsContent>

          <TabsContent value="automations" className="mt-4">
            <AutomationsManager boardId={boardId} codAgent={codAgent} pipelines={pipelines} />
          </TabsContent>

          <TabsContent value="general" className="mt-4">
            <div className="rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground">
              <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Configurações gerais do board</p>
              <p className="text-xs mt-1">Em breve: cores, ícone, arquivar board</p>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
