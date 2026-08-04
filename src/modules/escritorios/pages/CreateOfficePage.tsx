import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  CreditCard,
  Loader2,
  Puzzle,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const STEPS = [
  { id: 'escritorio', label: 'Escritório', icon: Building2 },
  { id: 'titular', label: 'Titular', icon: UserCircle },
  { id: 'plano', label: 'Plano', icon: CreditCard },
  { id: 'modulos', label: 'Módulos', icon: Puzzle },
] as const;

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
    if (step === 0)
      return form.is_new_client
        ? !!form.office_name.trim() && !!form.email.trim()
        : !!form.client_id;
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(ESCRITORIOS_ROUTES.list)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Novo Escritório</h1>
            <p className="text-sm text-muted-foreground">
              Preencha as informações para cadastrar um novo escritório
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <Tabs
            value={STEPS[step].id}
            onValueChange={(value) => {
              const index = STEPS.findIndex((s) => s.id === value);
              if (index !== -1) setStep(index);
            }}
          >
            <TabsList className="grid w-full grid-cols-4 mb-6">
              {STEPS.map((s) => {
                const Icon = s.icon;
                return (
                  <TabsTrigger
                    key={s.id}
                    value={s.id}
                    className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{s.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            <div className="min-h-[400px]">
              <TabsContent value="escritorio" className="mt-0">
                <OfficeDataStep form={form} set={set} />
              </TabsContent>
              <TabsContent value="titular" className="mt-0">
                <OfficeUserStep form={form} set={set} />
              </TabsContent>
              <TabsContent value="plano" className="mt-0">
                <OfficePlanStep form={form} set={set} />
              </TabsContent>
              <TabsContent value="modulos" className="mt-0">
                <OfficeModulesStep form={form} set={set} />
              </TabsContent>
            </div>
          </Tabs>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-6 border-t mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0 || isSaving}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Anterior
            </Button>

            {step < STEPS.length - 1 ? (
              <Button type="button" disabled={!canAdvance()} onClick={() => setStep((s) => s + 1)}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button type="button" disabled={!canAdvance() || isSaving} onClick={handleSubmit}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Cadastrar escritório
                  </>
                )}
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