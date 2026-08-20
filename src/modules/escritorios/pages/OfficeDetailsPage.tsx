import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Copy, Loader2, Lock, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useEscritoriosPermissions } from '../extend/auth';
import { applyOfficePermissions } from '../extend/permissions';
import { useOffice, useOfficeMutations } from '../hooks/useOffices';
import { useOfficeOwnerPassword } from '../hooks/useOfficeOwnerPassword';
import { ESCRITORIOS_ROUTES, OFFICE_MODULE_PACKAGE } from '../module';
import { MascoteLoader } from "@/components/ui/mascote-loader";

export default function OfficeDetailsPage() {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();
  const permissions = useEscritoriosPermissions();
  const { data: office, isLoading } = useOffice(officeId);
  const { updateOffice } = useOfficeMutations();

  const [modules, setModules] = useState<string[]>([]);
  const [leadsLimit, setLeadsLimit] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const { password, resetPassword, isResetting } = useOfficeOwnerPassword(office?.owner_user_id);

  useEffect(() => {
    if (!office) return;
    setModules(office.modules || []);
    setLeadsLimit(office.leads_limit ? String(office.leads_limit) : '');
    setDueDay(office.due_day ? String(office.due_day) : '');
    setExpiresAt(office.expires_at || '');
    setNotes(office.notes || '');
  }, [office]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <MascoteLoader size="xs" />
      </div>
    );
  }

  if (!office) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">Escritório não encontrado.</CardContent>
        </Card>
      </div>
    );
  }

  const toggle = (code: string) =>
    setModules((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const copyToClipboard = (value: string | null, label: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    toast.success(`${label} copiada para a área de transferência`);
  };

  const handleResetPassword = async () => {
    setShowConfirmReset(false);
    const result = await resetPassword();
    if (result.success && result.newPassword) {
      setNewPassword(result.newPassword);
      setShowNewPassword(true);
    } else {
      toast.error(result.error || 'Erro ao resetar senha');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (office.owner_user_id) {
        await applyOfficePermissions(Number(office.owner_user_id), modules);
      }
      await updateOffice.mutateAsync({
        id: office.id,
        patch: {
          modules,
          leads_limit: leadsLimit ? Number(leadsLimit) : null,
          due_day: dueDay ? Number(dueDay) : null,
          expires_at: expiresAt || null,
          notes: notes || null,
        },
      });
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar escritório');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Building2 className="h-6 w-6 text-primary" /> {office.office_name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {office.business_name || office.email} · Cliente #{office.client_id}
          </p>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => navigate(ESCRITORIOS_ROUTES.list)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Titular</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nome</p>
            <p className="text-sm font-medium">{office.owner_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">E-mail de acesso</p>
            <p className="text-sm font-medium">{office.owner_email || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Documento</p>
            <p className="text-sm font-medium">{office.federal_id || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={office.is_active ? 'default' : 'secondary'}>
              {office.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/50 p-3 sm:col-span-2">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Senha</p>
                <p className="font-mono text-sm font-medium">{password || '••••••••••'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {password && (
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(password, 'Senha')}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              {permissions.canEdit && office.owner_user_id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={isResetting}
                  onClick={() => setShowConfirmReset(true)}
                >
                  {isResetting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Resetar Senha
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Plano</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Limite de leads/atendimentos</Label>
            <Input
              type="number"
              value={leadsLimit}
              disabled={!permissions.canEdit}
              onChange={(e) => setLeadsLimit(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Dia de vencimento</Label>
            <Input
              type="number"
              min={1}
              max={31}
              value={dueDay}
              disabled={!permissions.canEdit}
              onChange={(e) => setDueDay(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Expira em</Label>
            <Input
              type="date"
              value={expiresAt}
              disabled={!permissions.canEdit}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Observações</Label>
            <Textarea
              rows={3}
              value={notes}
              disabled={!permissions.canEdit}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Módulos liberados</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICE_MODULE_PACKAGE.map((module) => (
            <label
              key={module.code}
              className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm"
            >
              <Checkbox
                checked={modules.includes(module.code)}
                disabled={!permissions.canEdit}
                onCheckedChange={() => toggle(module.code)}
              />
              {module.label}
            </label>
          ))}
        </CardContent>
      </Card>

      {permissions.canEdit && (
        <div className="flex justify-end">
          <Button className="rounded-full" disabled={saving} onClick={handleSave}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      )}

      <AlertDialog open={showConfirmReset} onOpenChange={setShowConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Senha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja gerar uma nova senha para o titular deste escritório? A senha atual será
              substituída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>Confirmar Reset</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNewPassword} onOpenChange={setShowNewPassword}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Senha Gerada</DialogTitle>
            <DialogDescription>A senha do titular foi resetada. Anote a nova senha:</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between rounded-lg bg-muted p-4">
              <code className="font-mono text-lg font-semibold">{newPassword}</code>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(newPassword, 'Nova senha')}>
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Esta senha foi salva no sistema. Recomendamos que o usuário altere a senha no primeiro acesso.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowNewPassword(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}