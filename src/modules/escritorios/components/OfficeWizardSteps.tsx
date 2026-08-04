import { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maskCPFCNPJ, maskPhone, maskCEP, unmask } from '@/lib/inputMasks';
import { externalDb } from '../extend/db';
import { OFFICE_MODULE_PACKAGE } from '../module';
import type { OfficeFormData } from '../types';
import { useOfficePlans } from '../hooks/useOfficePlans';
import { useOfficeClientSearch, type OfficeSearchedClient } from '../hooks/useOfficeClientSearch';

type Setter = <K extends keyof OfficeFormData>(key: K, value: OfficeFormData[K]) => void;

interface StepProps {
  form: OfficeFormData;
  set: Setter;
}

type ValidationStatus = 'idle' | 'checking' | 'valid' | 'invalid';

function StatusIcon({ status }: { status: ValidationStatus }) {
  if (status === 'checking') return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (status === 'valid') return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === 'invalid') return <AlertCircle className="h-4 w-4 text-destructive" />;
  return null;
}

/** Passo 1 — seleção/cadastro do escritório (cliente), no mesmo padrão do passo Cliente do agente. */
export function OfficeDataStep({ form, set }: StepProps) {
  const [federalStatus, setFederalStatus] = useState<ValidationStatus>('idle');
  const [loadingCep, setLoadingCep] = useState(false);
  const { searchTerm, setSearchTerm, results, isLoading, clearSearch } = useOfficeClientSearch();
  const [viewState, setViewState] = useState<'search' | 'selected' | 'new'>(
    form.client_id ? 'selected' : 'search',
  );

  const handleSelectClient = (client: OfficeSearchedClient) => {
    set('is_new_client', false);
    set('client_id', client.id);
    set('office_name', client.name || '');
    set('business_name', client.business_name || '');
    set('email', client.email || '');
    set('phone', client.phone || '');
    setViewState('selected');
    clearSearch();
  };

  const handleNewClient = () => {
    set('is_new_client', true);
    set('client_id', null);
    setViewState('new');
  };

  const handleChangeClient = () => {
    set('client_id', null);
    set('is_new_client', true);
    setViewState('search');
  };

  const checkFederalId = async (value: string) => {
    const clean = unmask(value);
    if (!clean || clean.length < 11) return setFederalStatus('idle');
    setFederalStatus('checking');
    try {
      const res = await externalDb.checkFederalIdExists(clean);
      setFederalStatus(res.exists ? 'invalid' : 'valid');
    } catch {
      setFederalStatus('idle');
    }
  };

  const lookupCep = async (value: string) => {
    const clean = unmask(value);
    if (clean.length !== 8) return;
    setLoadingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) return;
      set('street', data.logradouro || '');
      set('neighborhood', data.bairro || '');
      set('city', data.localidade || '');
      set('state', data.uf || '');
    } finally {
      setLoadingCep(false);
    }
  };

  if (viewState === 'search') {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Selecionar Escritório</h3>
          <p className="text-sm text-muted-foreground">
            Busque um escritório existente ou cadastre um novo
          </p>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar escritório por nome, razão social ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10"
            />
            {searchTerm && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button type="button" variant="outline" onClick={handleNewClient}>
            <UserPlus className="mr-2 h-4 w-4" />
            Novo Escritório
          </Button>
        </div>

        <div className="min-h-[300px] rounded-lg border">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchTerm.length < 3 ? (
            <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
              <Search className="mb-4 h-12 w-12 opacity-50" />
              <p className="text-center">
                Busque um escritório existente
                <br />
                ou clique em "Novo Escritório" para cadastrar
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex h-[300px] flex-col items-center justify-center text-muted-foreground">
              <p>Nenhum escritório encontrado</p>
              <Button type="button" variant="link" onClick={handleNewClient}>
                Cadastrar novo escritório
              </Button>
            </div>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="p-2">
                <p className="mb-2 px-2 py-1 text-sm text-muted-foreground">
                  {results.length} escritório(s) encontrado(s)
                </p>
                {results.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => handleSelectClient(client)}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{client.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {client.business_name || client.email || 'Sem informação adicional'}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </div>
    );
  }

  if (viewState === 'selected' && form.client_id) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Escritório Selecionado</h3>
          <p className="text-sm text-muted-foreground">Confirme os dados e siga para o titular</p>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-accent/30 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{form.office_name}</p>
              <p className="text-sm text-muted-foreground">{form.business_name || form.email}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={handleChangeClient}>
            <X className="mr-1 h-4 w-4" />
            Trocar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-foreground">Novo Escritório</h3>
          <p className="text-sm text-muted-foreground">
            Preencha os dados do escritório (opera sem agente da Julia)
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setViewState('search')}>
          <X className="mr-1 h-4 w-4" />
          Cancelar
        </Button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome do escritório *</Label>
          <Input value={form.office_name} onChange={(e) => set('office_name', e.target.value)} placeholder="Escritório Exemplo" />
        </div>
        <div className="space-y-2">
          <Label>Razão social</Label>
          <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="Opcional" />
        </div>
        <div className="space-y-2">
          <Label>CPF/CNPJ</Label>
          <div className="relative">
            <Input
              value={form.federal_id}
              onChange={(e) => {
                set('federal_id', maskCPFCNPJ(e.target.value));
                setFederalStatus('idle');
              }}
              onBlur={(e) => checkFederalId(e.target.value)}
              placeholder="000.000.000-00"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <StatusIcon status={federalStatus} />
            </div>
          </div>
          {federalStatus === 'invalid' && (
            <p className="text-xs text-destructive">CPF/CNPJ já cadastrado no sistema</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>E-mail *</Label>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="contato@escritorio.com" />
        </div>
        <div className="space-y-2">
          <Label>Telefone</Label>
          <Input value={form.phone} onChange={(e) => set('phone', maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
        </div>
        <div className="space-y-2">
          <Label>CEP</Label>
          <div className="relative">
            <Input
              value={form.zip_code}
              onChange={(e) => set('zip_code', maskCEP(e.target.value))}
              onBlur={(e) => lookupCep(e.target.value)}
              placeholder="00000-000"
            />
            {loadingCep && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Logradouro</Label>
          <Input value={form.street} onChange={(e) => set('street', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Número</Label>
          <Input value={form.street_number} onChange={(e) => set('street_number', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Complemento</Label>
          <Input value={form.complement} onChange={(e) => set('complement', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Bairro</Label>
          <Input value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Input value={form.state} onChange={(e) => set('state', e.target.value)} maxLength={2} />
        </div>
      </div>
    </div>
  );
}

/** Passo 2 — usuário titular. */
export function OfficeUserStep({ form, set }: StepProps) {
  const [emailStatus, setEmailStatus] = useState<ValidationStatus>('idle');

  const checkEmail = async (value: string) => {
    if (!value.includes('@')) return setEmailStatus('idle');
    setEmailStatus('checking');
    try {
      const res = await externalDb.checkUserEmailExists(value);
      setEmailStatus(res.exists ? 'invalid' : 'valid');
    } catch {
      setEmailStatus('idle');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Usuário Titular</h3>
        <p className="text-sm text-muted-foreground">
          Será o dono do escritório. A senha temporária é gerada automaticamente.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome do titular *</Label>
          <Input value={form.user_name} onChange={(e) => set('user_name', e.target.value)} placeholder="Nome completo" />
        </div>
        <div className="space-y-2">
          <Label>E-mail de acesso *</Label>
          <div className="relative">
            <Input
              type="email"
              value={form.user_email}
              onChange={(e) => {
                set('user_email', e.target.value);
                setEmailStatus('idle');
              }}
              onBlur={(e) => checkEmail(e.target.value)}
              placeholder="titular@escritorio.com"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <StatusIcon status={emailStatus} />
            </div>
          </div>
          {emailStatus === 'invalid' && <p className="text-xs text-destructive">E-mail já cadastrado no sistema</p>}
        </div>
      </div>
    </div>
  );
}

/** Passo 3 — plano, limite e vencimento. */
export function OfficePlanStep({ form, set }: StepProps) {
  const { data: plans = [], isLoading } = useOfficePlans();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Plano</h3>
        <p className="text-sm text-muted-foreground">Limite de atendimentos, vencimento e validade</p>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Plano</Label>
          <Select
            value={form.plan_id}
            onValueChange={(value) => {
              set('plan_id', value);
              const plan = plans.find((p) => String(p.id) === value);
              if (plan?.leads_limit) set('leads_limit', String(plan.leads_limit));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoading ? 'Carregando...' : 'Selecione o plano'} />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={String(plan.id)}>
                  {plan.name}
                  {plan.leads_limit ? ` — ${plan.leads_limit} leads` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Limite de leads/atendimentos</Label>
          <Input
            type="number"
            min={0}
            value={form.leads_limit}
            onChange={(e) => set('leads_limit', e.target.value)}
            placeholder="Ex: 1000"
          />
        </div>
        <div className="space-y-2">
          <Label>Dia de vencimento</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={form.due_day}
            onChange={(e) => set('due_day', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Expira em</Label>
          <Input type="date" value={form.expires_at} onChange={(e) => set('expires_at', e.target.value)} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Observações</Label>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </div>
      </div>
    </div>
  );
}

/** Passo 4 — módulos liberados. */
export function OfficeModulesStep({ form, set }: StepProps) {
  const toggle = (code: string) => {
    const next = form.modules.includes(code)
      ? form.modules.filter((c) => c !== code)
      : [...form.modules, code];
    set('modules', next);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-medium">Módulos Liberados</h3>
          <p className="text-sm text-muted-foreground">
            Pacote padrão sugerido automaticamente — desmarque o que não deve ser liberado.
          </p>
        </div>
        <Badge variant="secondary">{form.modules.length} selecionado(s)</Badge>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OFFICE_MODULE_PACKAGE.map((module) => {
          const checked = form.modules.includes(module.code);
          return (
            <Card
              key={module.code}
              className={checked ? 'border-primary/60 bg-accent/40' : ''}
              onClick={() => toggle(module.code)}
            >
              <CardContent className="flex cursor-pointer items-center gap-3 p-4">
                <Checkbox checked={checked} onCheckedChange={() => toggle(module.code)} />
                <span className="text-sm font-medium">{module.label}</span>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}