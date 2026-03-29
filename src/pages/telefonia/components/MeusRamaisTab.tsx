import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Phone, RefreshCw, CheckCircle, AlertCircle, Ban, CalendarDays } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { RamalDialog } from './RamalDialog';
import type { PhoneExtension, ProviderType } from '../types';
import { PROVIDER_LABELS } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { format, isPast, parseISO } from 'date-fns';

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

interface Props {
  codAgent: string;
}

export function MeusRamaisTab({ codAgent }: Props) {
  // Fetch provider from phone_config so we can route mutations correctly
  const { data: configData } = useQuery({
    queryKey: ['phone-config-provider', codAgent],
    queryFn: async () => {
      const { data } = await supabase
        .from('phone_config')
        .select('provider')
        .eq('cod_agent', codAgent)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!codAgent,
  });
  const provider: ProviderType = (configData?.provider as ProviderType) || 'api4com';

  const { extensions, extensionsLoading, maxExtensions, usedExtensions, canCreateExtension, plan, createExtension, updateExtension, deleteExtension, syncExtensions } = useTelefoniaData(codAgent, provider);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PhoneExtension | null>(null);

  const handleSave = (ext: Partial<PhoneExtension> & { email?: string; memberName?: string }) => {
    if (editing) {
      updateExtension.mutate({ ...ext, id: editing.id });
    } else {
      createExtension.mutate(ext);
    }
    setDialogOpen(false);
    setEditing(null);
  };

  const usagePercent = maxExtensions > 0 ? (usedExtensions / maxExtensions) * 100 : 0;
  const planDeactivated = !plan && !extensionsLoading;
  const isExpired = plan?.due_date ? isPast(parseISO(plan.due_date)) : false;

  return (
    <div className="space-y-4">
      {planDeactivated && (
        <Alert variant="destructive">
          <Ban className="h-4 w-4" />
          <AlertDescription>
            A telefonia está desativada para este agente. Entre em contato com o administrador.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">
                Plano: {plan?.plan_name || 'Nenhum plano vinculado'}
                {plan?.billing_period && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    {PERIOD_LABELS[plan.billing_period] || plan.billing_period}
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {usedExtensions} de {maxExtensions} ramais
                {plan && plan.extra_extensions > 0 && (
                  <span className="ml-1">({plan.base_extensions} do plano + {plan.extra_extensions} extras)</span>
                )}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge variant={canCreateExtension ? 'default' : 'destructive'}>
                {canCreateExtension ? 'Disponível' : 'Limite atingido'}
              </Badge>
              {isExpired && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" /> Vencido
                </Badge>
              )}
            </div>
          </div>
          <Progress value={usagePercent} className="h-2" />
          {plan?.start_date && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                Início: {format(parseISO(plan.start_date), 'dd/MM/yyyy')}
              </span>
              {plan.due_date && (
                <span className={isExpired ? 'text-destructive font-medium' : ''}>
                  Vencimento: {format(parseISO(plan.due_date), 'dd/MM/yyyy')}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Meus Ramais
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }} disabled={!canCreateExtension || planDeactivated}>
              <Plus className="h-4 w-4 mr-1" /> Novo Ramal
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {extensionsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ramal Local</TableHead>
                  <TableHead>Nº Provedor</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Membro</TableHead>
                  <TableHead>Vínculo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extensions.map((ext) => {
                  const extProvider: ProviderType = (ext.provider as ProviderType) || provider;
                  const isLinked = extProvider === '3cplus'
                    ? !!(ext.threecplus_agent_id || ext.threecplus_extension)
                    : !!ext.api4com_ramal;
                  const providerNumber = extProvider === '3cplus'
                    ? (ext.threecplus_extension || ext.threecplus_agent_id)
                    : ext.api4com_ramal;
                  return (
                    <TableRow key={ext.id}>
                      <TableCell className="font-mono font-medium">{ext.extension_number}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1">
                          {providerNumber || <span className="text-muted-foreground">—</span>}
                          <Badge variant="outline" className="text-[10px] px-1 py-0 hidden sm:inline-flex">
                            {PROVIDER_LABELS[extProvider] || extProvider}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{ext.label || '-'}</TableCell>
                      <TableCell>{ext.assigned_member_id || '-'}</TableCell>
                      <TableCell>
                        {isLinked ? (
                          <Badge variant="default" className="gap-1 bg-green-600">
                            <CheckCircle className="h-3 w-3" /> Vinculado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Sem vínculo
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={ext.is_active ? 'default' : 'secondary'}>
                          {ext.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(ext); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteExtension.mutate(ext.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {extensions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum ramal criado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RamalDialog open={dialogOpen} onOpenChange={setDialogOpen} extension={editing} onSave={handleSave} codAgent={codAgent} isCreating={createExtension.isPending} existingExtensions={extensions} />
    </div>
  );
}
