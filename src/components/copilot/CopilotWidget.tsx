import { useState } from 'react';
import { AudioLines, CheckCheck, Bell, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useCopilotInsights } from '@/hooks/useCopilotInsights';
import { CopilotInsightCard } from './CopilotInsightCard';
import { CopilotChatTab } from './CopilotChatTab';
import { cn } from '@/lib/utils';

export function CopilotWidget() {
  const [open, setOpen] = useState(false);
  const { insights, unreadCount, isLoading, markAsRead, markAllAsRead, hasInteractive } =
    useCopilotInsights();

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-6 right-6 z-40 flex items-center justify-center',
          'h-14 w-14 rounded-full shadow-lg',
          'bg-primary text-primary-foreground',
          'hover:scale-105 active:scale-95 transition-transform',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label="Abrir Copiloto Julia"
      >
        <AudioLines className="h-6 w-6" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-[10px] flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </button>

      {/* Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col p-0">
          <SheetHeader className="p-4 pb-2 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2 text-base">
                <AudioLines className="h-4 w-4 text-primary" />
                Copiloto Julia
              </SheetTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => markAllAsRead.mutate()}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Marcar todas
                </Button>
              )}
            </div>
            <SheetDescription className="text-xs">
              Insights automáticos sobre seus leads e CRM
            </SheetDescription>
          </SheetHeader>

          {hasInteractive ? (
            <Tabs defaultValue="alerts" className="flex-1 flex flex-col">
              <TabsList className="mx-3 mt-2">
                <TabsTrigger value="alerts" className="flex-1 gap-1">
                  <Bell className="h-3 w-3" />
                  Alertas
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="h-4 min-w-[16px] px-1 text-[9px]">
                      {unreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="chat" className="flex-1 gap-1">
                  <MessageCircle className="h-3 w-3" />
                  Chat
                </TabsTrigger>
              </TabsList>

              <TabsContent value="alerts" className="flex-1 m-0">
                <ScrollArea className="h-full p-3">
                  {renderAlerts(isLoading, insights, markAsRead)}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="chat" className="flex-1 m-0">
                <CopilotChatTab />
              </TabsContent>
            </Tabs>
          ) : (
            <ScrollArea className="flex-1 p-3">
              {renderAlerts(isLoading, insights, markAsRead)}
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function renderAlerts(isLoading: boolean, insights: any[], markAsRead: any) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AudioLines className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm font-medium">Nenhum insight ainda</p>
        <p className="text-xs mt-1 text-center max-w-[240px]">
          Ative o Copiloto nas configurações do agente para receber análises automáticas.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {insights.map((insight: any) => (
        <CopilotInsightCard
          key={insight.id}
          insight={insight}
          onMarkAsRead={(id: string) => markAsRead.mutate(id)}
        />
      ))}
    </div>
  );
}
