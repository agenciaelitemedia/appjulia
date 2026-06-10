import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, List, LayoutGrid, LayoutDashboard, Settings, LifeBuoy } from 'lucide-react';
import { useTicketRole, type TicketFilters } from './hooks/useTickets';
import { TicketsListTab } from './components/TicketsListTab';
import { TicketsKanban } from './components/TicketsKanban';
import { TicketsDashboard } from './components/TicketsDashboard';
import { SupportSettingsTab } from './components/SupportSettingsTab';
import { NewTicketDialog } from './components/NewTicketDialog';
import { useNavigate } from 'react-router-dom';

const TICKETS_VIEW_KEY = 'tickets:lastView';
type TicketsView = 'list' | 'kanban' | 'dashboard' | 'settings';

export default function TicketsPage() {
  const role = useTicketRole();
  const navigate = useNavigate();
  const [newOpen, setNewOpen] = useState(false);
  const [filters, setFilters] = useState<TicketFilters>({ status: 'all', priority: 'all' });
  const isAgent = role === 'agent';
  const canKanban = role === 'agent' || role === 'manager';

  const [view, setView] = useState<TicketsView>(() => {
    if (typeof window === 'undefined') return 'list';
    const saved = window.localStorage.getItem(TICKETS_VIEW_KEY) as TicketsView | null;
    if (saved === 'list' || saved === 'dashboard') return saved;
    if (saved === 'kanban' && (role === 'agent' || role === 'manager')) return saved;
    if (saved === 'settings' && role === 'agent') return saved;
    return 'list';
  });

  useEffect(() => {
    if (view === 'settings' && !isAgent) {
      setView('list');
    }
    if (view === 'kanban' && !canKanban) {
      setView('list');
    }
  }, [view, isAgent, canKanban]);

  const handleViewChange = (v: string) => {
    const next = v as TicketsView;
    setView(next);
    try { window.localStorage.setItem(TICKETS_VIEW_KEY, next); } catch {}
  };

  const header = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-2">
        <LifeBuoy className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold leading-none">Suporte / Chamados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {role === 'requester' ? 'Acompanhe e abra seus chamados de suporte'
              : role === 'manager' ? 'Chamados do seu escritório'
              : 'Central de atendimento de suporte'}
          </p>
        </div>
      </div>
      <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> Abrir chamado</Button>
    </div>
  );

  // Solicitante: lista simples dos próprios chamados.
  if (role === 'requester') {
    return (
      <div className="space-y-5">
        {header}
        <TicketsListTab
          filters={filters}
          onFiltersChange={setFilters}
          emptyHint="Você ainda não abriu chamados. Clique em “Abrir chamado”."
        />
        <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => navigate(`/tickets/${id}`)} />
      </div>
    );
  }

  // Atendente (admin) e gestor do escritório: workspace com abas.
  return (
    <div className="space-y-5">
      {header}
      <Tabs value={view} onValueChange={handleViewChange}>
        <TabsList>
          <TabsTrigger value="list" className="gap-2"><List className="h-4 w-4" /> Lista</TabsTrigger>
          {canKanban && <TabsTrigger value="kanban" className="gap-2"><LayoutGrid className="h-4 w-4" /> Kanban</TabsTrigger>}
          <TabsTrigger value="dashboard" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Dashboard</TabsTrigger>
          {isAgent && <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="mt-5">
          <TicketsListTab filters={filters} onFiltersChange={setFilters} showRequester />
        </TabsContent>

        {canKanban && (
          <TabsContent value="kanban" className="mt-5">
            <TicketsKanban filters={filters} />
          </TabsContent>
        )}

        <TabsContent value="dashboard" className="mt-5">
          <TicketsDashboard />
        </TabsContent>

        {isAgent && (
          <TabsContent value="settings" className="mt-5">
            <SupportSettingsTab />
          </TabsContent>
        )}
      </Tabs>

      <NewTicketDialog open={newOpen} onOpenChange={setNewOpen} onCreated={(id) => navigate(`/tickets/${id}`)} />
    </div>
  );
}
