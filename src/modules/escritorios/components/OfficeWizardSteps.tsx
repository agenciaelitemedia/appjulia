import { useState } from 'react';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { maskCPFCNPJ, maskPhone, maskCEP, unmask } from '@/lib/inputMasks';
import { externalDb } from '../extend/db';
import { OFFICE_MODULE_PACKAGE } from '../module';
import type { OfficeFormData } from '../types';
import { useOfficePlans } from '../hooks/useOfficePlans';

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

/** Passo 1 — dados do escritório (cliente). */
export function OfficeDataStep({ form, set }: StepProps) {
  const [federalStatus, setFederalStatus] = useState<ValidationStatus>('idle');
  const [loadingCep, setLoadingCep] = useState(false);

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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Dados do Escritório</h3>
        <p className="text-sm text-muted-foreground">Escritório operando sem agente da Julia</p>
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