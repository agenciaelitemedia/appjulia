import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2, Layers } from 'lucide-react';
import { CustomFieldsManager } from '../custom-fields/CustomFieldsManager';

interface BoardSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  codAgent: string;
  boardName: string;
}

export function BoardSettingsSheet({
  open,
  onOpenChange,
  boardId,
  codAgent,
  boardName,
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

        <Tabs defaultValue="custom-fields" className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="custom-fields" className="gap-2">
              <Layers className="h-4 w-4" />
              Campos
            </TabsTrigger>
            <TabsTrigger value="general" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Geral
            </TabsTrigger>
          </TabsList>

          <TabsContent value="custom-fields" className="mt-4">
            <CustomFieldsManager boardId={boardId} codAgent={codAgent} />
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
