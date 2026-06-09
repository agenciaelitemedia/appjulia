import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Network, MessageSquare, History, Trash2, Activity, Wrench, CreditCard, ShoppingBag, RefreshCw } from 'lucide-react';
import { ChatSettingsTab } from '@/pages/configuracoes/components/ChatSettingsTab';
import { UazapiHistoryTab } from '@/pages/configuracoes/components/UazapiHistoryTab';
import { UazapiMonitorTab } from '@/pages/configuracoes/components/UazapiMonitorTab';
import { QueueMaintenanceTab } from '@/pages/configuracoes/components/QueueMaintenanceTab';
import { QueuePlansTab } from './components/QueuePlansTab';
import { QueueOrdersTab } from './components/QueueOrdersTab';
import { useQueueProviders, useQueueProviderMutations, type QueueProvider } from '@/pages/configuracoes/hooks/useQueueProviders';
import { ProviderCard } from '@/pages/configuracoes/components/ProviderCard';
import { ProviderFormDialog } from '@/pages/configuracoes/components/ProviderFormDialog';
import { ResetChatDialog } from '@/pages/configuracoes/components/ResetChatDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ChatAdminPage() {
  const { data: providers = [], isLoading } = useQueueProviders();
  const { deleteProvider } = useQueueProviderMutations();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || isLoading || !user?.client_id) return;
    const hasUazapi = providers.some((p) => p.provider_type === 'uazapi');
    if (hasUazapi) { seeded.current = true; return; }

    seeded.current = true;
    supabase.functions.invoke('seed-uazapi-provider', {
      body: { client_id: String(user.client_id) },
    }).then(({ error }) => {
      if (!error) queryClient.invalidateQueries({ queryKey: ['queue-providers'] });
    });
  }, [isLoading, providers, user?.client_id, queryClient]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<QueueProvider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QueueProvider | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [reapplying, setReapplying] = useState(false);

  const handleEdit = (p: QueueProvider) => { setEditingProvider(p); setFormOpen(true); };
  const handleNew = () => { setEditingProvider(null); setFormOpen(true); };
  const handleConfirmDelete = () => {
    if (deleteTarget) { deleteProvider.mutate(deleteTarget.id); setDeleteTarget(null); }
  };

  const handleReapplyWebhooks = async () => {
    if (reapplying) return;
    setReapplying(true);
    const t = toast.loading('Reaplicando webhooks em todas as filas UaZapi...');
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-instance-manager', {
        body: { action: 'reconfigure_webhook_all' },
      });
      if (error) throw error;
      const results = (data as any)?.results ?? [];
      const ok = results.filter((r: any) => r.ok).length;
      const fail = results.length - ok;
      toast.success(`Webhooks reaplicados: ${ok} ok${fail ? `, ${fail} falhas` : ''}`, { id: t });
    } catch (e: any) {
      toast.error(`Falha ao reaplicar webhooks: ${e?.message ?? e}`, { id: t });
    } finally {
      setReapplying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Chat (Admin)</h1>
          <p className="text-sm text-muted-foreground">Provedores de fila, configurações por cliente, histórico e monitoramento</p>
        </div>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList>
          <TabsTrigger value="chat" className="gap-2"><MessageSquare className="w-4 h-4" />Chat</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2"><CreditCard className="w-4 h-4" />Planos</TabsTrigger>
          <TabsTrigger value="orders" className="gap-2"><ShoppingBag className="w-4 h-4" />Pedidos</TabsTrigger>
          <TabsTrigger value="providers" className="gap-2"><Network className="w-4 h-4" />Provedores de Fila</TabsTrigger>
          <TabsTrigger value="uazapi-history" className="gap-2"><History className="w-4 h-4" />History UaZapi</TabsTrigger>
          <TabsTrigger value="uazapi-monitor" className="gap-2"><Activity className="w-4 h-4" />Monitor da Fila</TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-2"><Wrench className="w-4 h-4" />Manutenção de Filas</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6"><ChatSettingsTab /></TabsContent>
        <TabsContent value="plans" className="mt-6"><QueuePlansTab /></TabsContent>
        <TabsContent value="orders" className="mt-6"><QueueOrdersTab /></TabsContent>

        <TabsContent value="providers" className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Provedores de Fila</h2>
              <p className="text-sm text-muted-foreground">
                Configure as credenciais dos canais de comunicação que serão usadas nas filas
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleReapplyWebhooks} disabled={reapplying}>
                {reapplying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Reaplicar webhooks (UaZapi)
              </Button>
              <Button variant="destructive" onClick={() => setResetOpen(true)}>
                <Trash2 className="w-4 h-4 mr-2" /> Resetar Chat
              </Button>
              <Button onClick={handleNew}>
                <Plus className="w-4 h-4 mr-2" /> Novo Provedor
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg">
              <Network className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="mb-1 font-medium">Nenhum provedor configurado</p>
              <p className="text-sm">Adicione um provedor para poder criar filas de atendimento</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((p) => (
                <ProviderCard key={p.id} provider={p} onEdit={handleEdit} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="uazapi-history" className="mt-6"><UazapiHistoryTab /></TabsContent>
        <TabsContent value="uazapi-monitor" className="mt-6"><UazapiMonitorTab /></TabsContent>
        <TabsContent value="maintenance" className="mt-6"><QueueMaintenanceTab /></TabsContent>
      </Tabs>

      <ProviderFormDialog open={formOpen} onOpenChange={setFormOpen} provider={editingProvider} />
      <ResetChatDialog open={resetOpen} onOpenChange={setResetOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir provedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o provedor "{deleteTarget?.name}"? Filas que usam este provedor não serão afetadas, mas novas filas não poderão utilizá-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}