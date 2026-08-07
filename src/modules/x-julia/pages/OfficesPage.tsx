/**
 * Escritórios X-Julia — passo 1 do fluxo: escolher (ou criar) o escritório
 * e depois gerenciar os N agentes daquele ClientID.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronRight, Loader2, Plus, Search, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { maskCPFCNPJ, maskPhone } from '@/lib/inputMasks';
import { XJLayout } from '../components/XJLayout';
import { useXJOffices } from '../hooks/useXJOffices';
import { useXJClientSearch, createXJClient } from '../extend/clients';
import { useXJScope } from '../context/XJScopeContext';
import { useXJPermissions } from '../extend/auth';
import { X_JULIA_ROUTES, XJ_LLM_PROVIDERS } from '../module';

export default function XJOfficesPage() {
  const navigate = useNavigate();
  const { data: offices = [], isLoading, refetch } = useXJOffices();
  const { setScope } = useXJScope();
  const permissions = useXJPermissions('x_julia_agents');
  const { searchTerm, setSearchTerm, results, isLoading: searching, clearSearch } = useXJClientSearch();

  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', business_name: '', federal_id: '', email: '', phone: '' });

  const open = (clientId: string, label?: string | null) => {
    setScope(String(clientId), label ?? null);
    navigate(X_JULIA_ROUTES.agents);
  };

  const providerLabel = (id: string) => XJ_LLM_PROVIDERS.find((p) => p.id === id)?.label ?? id;

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const client = await createXJClient(form);
      toast.success('Escritório criado');
      setCreating(false);
      setForm({ name: '', business_name: '', federal_id: '', email: '', phone: '' });
      await refetch();
      open(String(client.id), client.business_name || client.name);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar escritório');
    } finally {
      setSaving(false);
    }
  };

  return (
    <XJLayout
      title="Escritórios X-Julia"
      description="Selecione o escritório (ClientID) para gerenciar seus agentes"
      actions={
        permissions.canCreate && (
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo escritório
          </Button>
        )
      }
    >
      <Card>
        <CardContent className="space-y-3 pt-6">
          <Label>Buscar escritório na base de clientes</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Nome, e-mail ou CPF/CNPJ (mín. 3 caracteres)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {searching && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
            </div>
          )}
          {!searching && searchTerm.length >= 3 && results.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum escritório encontrado.</p>
          )}
          {results.length > 0 && (
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-1">
              {results.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => {
                    open(String(client.id), client.business_name || client.name);
                    clearSearch();
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {client.business_name || client.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      ClientID {client.id}
                      {client.email ? ` · ${client.email}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Escritórios com agentes X-Julia</h2>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : offices.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              Nenhum escritório com agente X-Julia ainda. Busque acima ou crie um novo.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {offices.map((office) => (
              <Card key={office.clientId} className="cursor-pointer transition hover:border-primary/40">
                <CardContent className="space-y-3 p-4" onClick={() => open(office.clientId, office.businessName || office.name)}>
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{office.businessName || office.name}</p>
                      <p className="text-xs text-muted-foreground">ClientID {office.clientId}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" /> {office.agents} agente{office.agents === 1 ? '' : 's'}
                    </Badge>
                    <Badge variant={office.activeAgents ? 'default' : 'outline'}>
                      {office.activeAgents} ativo{office.activeAgents === 1 ? '' : 's'}
                    </Badge>
                    {office.providers.map((p) => (
                      <Badge key={p} variant="outline">{providerLabel(p)}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo escritório</DialogTitle>
            <DialogDescription>
              Cria o cliente (ClientID) na base e abre a tela de agentes X-Julia dele.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome do escritório *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Razão social</Label>
              <Input
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CPF/CNPJ</Label>
              <Input
                value={form.federal_id}
                onChange={(e) => setForm({ ...form, federal_id: maskCPFCNPJ(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>E-mail</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Criar escritório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </XJLayout>
  );
}