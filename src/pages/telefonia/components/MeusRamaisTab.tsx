import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Pencil, Trash2, Phone, RefreshCw, CheckCircle, AlertCircle, Ban, CalendarDays, PhoneOff, KeyRound } from 'lucide-react';
import { useTelefoniaData } from '../hooks/useTelefoniaData';
import { RamalDialog } from './RamalDialog';
import { SipManualCredentialsDialog } from './SipManualCredentialsDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  codAgent?: string;
  clientId?: number | null;
}

export function MeusRamaisTab({ codAgent, clientId }: Props) {
  const navigate = useNavigate();
  const useClient = !!clientId;
  const partitionKey = useClient ? `c:${clientId}` : `a:${codAgent || ''}`;
  // Fetch provider from phone_config so we can route mutations correctly
  const { data: configData } = useQuery({
    queryKey: ['phone-config-provider', partitionKey],
    queryFn: async () => {
      const base = supabase.from('phone_config').select('*').eq('is_active', true);
      const { data } = useClient
        ? await base.eq('client_id', clientId!).limit(1).maybeSingle()
        : await base.eq('cod_agent', codAgent!).limit(1).maybeSingle();
      return data;
    },
    enabled: useClient || !!codAgent,
  });
  const provider: ProviderType = ((configData as any)?.provider as ProviderType) || 'api4com';

  const { extensions, extensionsLoading, maxExtensions, usedExtensions, canCreateExtension, plan, createExtension, updateExtension, deleteExtension, syncExtensions } = useTelefoniaData(codAgent, provider, clientId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PhoneExtension | null>(null);
  const [sipCredsOpen, setSipCredsOpen] = useState(false);
  const [sipCredsExt, setSipCredsExt] = useState<PhoneExtension | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PhoneExtension | null>(null);
  const [confirmA, setConfirmA] = useState(false);
  const [confirmB, setConfirmB] = useState(false);
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

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
        <div className="text-center py-6 space-y-2">
          <PhoneOff className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium text-destructive">Você não possui ramal ativo.</p>
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-yellow-700 dark:text-yellow-400 max-w-md mx-auto">
            <p className="text-base leading-snug">
              Para ter acesso às ligações você precisa fazer a contratação de um plano de telefonia.
            </p>
            <p className="text-base leading-snug mt-1">
              Entre em contato com o administrador do sistema para mais informações.
            </p>
          </div>
          <Button onClick={() => navigate('/telefonia/contratar')} className="mt-2">
            <Phone className="h-4 w-4 mr-1" /> Contratar Telefonia
          </Button>
        </div>
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
            <Button
              size="sm"
              onClick={() => {
                if (planDeactivated) { navigate('/telefonia/contratar'); return; }
                if (!canCreateExtension) { setLimitDialogOpen(true); return; }
                setEditing(null);
                setDialogOpen(true);
              }}
            >
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
                          {extProvider === '3cplus' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={(ext as any).sip_manual_domain ? 'Credenciais SIP manuais ativas' : 'Definir credenciais SIP manuais'}
                              onClick={() => { setSipCredsExt(ext); setSipCredsOpen(true); }}
                            >
                              <KeyRound className={`h-3.5 w-3.5 ${(ext as any).sip_manual_domain ? 'text-green-600' : ''}`} />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditing(ext); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { setDeleteTarget(ext); setConfirmA(false); setConfirmB(false); }}>
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
      <SipManualCredentialsDialog open={sipCredsOpen} onOpenChange={setSipCredsOpen} extension={sipCredsExt} />

      <AlertDialog open={limitDialogOpen} onOpenChange={setLimitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limite de ramais atingido</AlertDialogTitle>
            <AlertDialogDescription>
              Seu plano permite {maxExtensions === 1 ? '1 ramal' : `${maxExtensions} ramais`} e você já está utilizando {usedExtensions === 1 ? '1 ramal' : `${usedExtensions} ramais`}.
              Para adicionar {maxExtensions - usedExtensions <= 0 ? 'mais ramais' : 'novos ramais além do limite'}, adquira ramais adicionais.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setLimitDialogOpen(false); navigate('/telefonia/contratar'); }}>
              {maxExtensions === 0 ? 'Contratar plano' : 'Contratar mais ramais'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setConfirmA(false); setConfirmB(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Remover ramal {deleteTarget?.extension_number}
            </DialogTitle>
            <DialogDescription>
              Esta ação é <strong>irreversível</strong>. O ramal será removido do provedor e do sistema.
              Para confirmar, ative as duas chaves abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-3 p-3 rounded-md border">
              <Switch checked={confirmA} onCheckedChange={setConfirmA} />
              <Label className="text-sm">Entendo que o ramal será desvinculado e excluído.</Label>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-md border">
              <Switch checked={confirmB} onCheckedChange={setConfirmB} />
              <Label className="text-sm">Confirmo a exclusão definitiva deste ramal.</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!confirmA || !confirmB || deleteExtension.isPending}
              onClick={() => {
                if (!deleteTarget) return;
                deleteExtension.mutate(deleteTarget.id, {
                  onSuccess: () => { setDeleteTarget(null); setConfirmA(false); setConfirmB(false); },
                });
              }}
            >
              {deleteExtension.isPending ? 'Removendo...' : 'Remover ramal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
