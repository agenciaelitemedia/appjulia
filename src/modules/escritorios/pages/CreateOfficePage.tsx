import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Building2, Check, Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useEscritoriosIdentity, useEscritoriosPermissions } from '../extend/auth';
import { useEnsureEscritoriosModule } from '../extend/useEnsureEscritoriosModule';
import { useOfficeSave } from '../hooks/useOfficeSave';
import { emptyOfficeForm, type OfficeFormData } from '../types';
import { ESCRITORIOS_ROUTES, OFFICE_MODULE_CODES } from '../module';
import {
  OfficeDataStep,
  OfficeModulesStep,
  OfficePlanStep,
  OfficeUserStep,
} from '../components/OfficeWizardSteps';

const STEPS = ['Escritório', 'Titular', 'Plano', 'Módulos'] as const;

export default function CreateOfficePage() {
  useEnsureEscritoriosModule();
  const navigate = useNavigate();
  const { user } = useEscritoriosIdentity();
  const permissions = useEscritoriosPermissions();
  const { saveOffice, isSaving } = useOfficeSave();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OfficeFormData>({
    ...emptyOfficeForm(),
    modules: [...OFFICE_MODULE_CODES],
  });
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  const set = <K extends keyof OfficeFormData>(key: K, value: OfficeFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  if (!permissions.canCreate) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para cadastrar escritórios.
          </CardContent>
        </Card>
      </div>
    );
  }

  const canAdvance = () => {
    if (step === 0) return !!form.office_name.trim() && !!form.email.trim();
    if (step === 1) return !!form.user_name.trim() && form.user_email.includes('@');
    if (step === 3) return form.modules.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    const result = await saveOffice(form, user?.name);
    if (!result.success) {
      toast.error(result.error || 'Erro ao cadastrar escritório');
      return;
    }
    toast.success('Escritório cadastrado com sucesso');
    if (result.tempPassword) {
      setCredentials({ email: form.user_email, password: result.tempPassword });
    } else {
      navigate(ESCRITORIOS_ROUTES.list);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-6 w-6 text-primary" /> Novo Escritório
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de cliente e usuário sem agente da Julia, com liberação de módulos
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => navigate(ESCRITORIOS_ROUTES.list)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => index < step && setStep(index)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
              index === step && 'border-primary bg-primary/10 font-medium text-primary',
              index < step && 'border-emerald-500/40 text-emerald-600',
              index > step && 'text-muted-foreground',
            )}
          >
            {index < step ? <Check className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}
            {label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && <OfficeDataStep form={form} set={set} />}
          {step === 1 && <OfficeUserStep form={form} set={set} />}
          {step === 2 && <OfficePlanStep form={form} set={set} />}
          {step === 3 && <OfficeModulesStep form={form} set={set} />}

          <Separator className="my-6" />

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              className="rounded-full"
              disabled={step === 0 || isSaving}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Anterior
            </Button>

            {step < STEPS.length - 1 ? (
              <Button className="rounded-full" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
                Próximo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button className="rounded-full" disabled={!canAdvance() || isSaving} onClick={handleSubmit}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Cadastrar escritório
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!credentials} onOpenChange={() => {}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acesso criado</DialogTitle>
            <DialogDescription>
              Envie estas credenciais ao titular. A senha temporária não será exibida novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
            <p>
              <span className="text-muted-foreground">E-mail: </span>
              <span className="font-medium">{credentials?.email}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Senha temporária: </span>
              <span className="font-mono font-medium">{credentials?.password}</span>
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                navigator.clipboard.writeText(`${credentials?.email} / ${credentials?.password}`);
                toast.success('Credenciais copiadas');
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar
            </Button>
            <Button className="rounded-full" onClick={() => navigate(ESCRITORIOS_ROUTES.list)}>
              Concluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}