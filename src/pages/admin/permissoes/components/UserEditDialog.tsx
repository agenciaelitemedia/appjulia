import { useState, useEffect } from 'react';
import { Copy, Check, Key, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { externalDb } from '@/lib/externalDb';
import { useUpdateUserProfile, useResetUserPassword } from '../hooks/usePermissionsAdmin';
import type { UserWithPermissions } from '../types';
import { roleLabels } from '../types';
import type { AppRole } from '@/types/permissions';

interface UserEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserWithPermissions;
  currentUserId: number;
  onSuccess?: () => void;
}

const roleOptions: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'colaborador', label: 'Colaborador' },
  { value: 'user', label: 'Usuário' },
  { value: 'time', label: 'Time' },
];

export function UserEditDialog({
  open,
  onOpenChange,
  user,
  currentUserId,
  onSuccess,
}: UserEditDialogProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState<AppRole>(user.role);
  const [isActive, setIsActive] = useState(user.is_active);
  const [emailError, setEmailError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const updateProfile = useUpdateUserProfile();
  const resetPassword = useResetUserPassword();

  const isSelf = user.id === currentUserId;
  const isTimeUser = user.role === 'time';

  // Reset form when user changes
  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setIsActive(user.is_active);
    setEmailError('');
    setTemporaryPassword(null);
    setCopied(false);
  }, [user, open]);

  const validateEmail = async () => {
    if (email === user.email) {
      setEmailError('');
      return true;
    }

    try {
      const result = await externalDb.checkUserEmailExists(email);
      if (result.exists) {
        setEmailError('Este email já está em uso por outro usuário');
        return false;
      }
      setEmailError('');
      return true;
    } catch (error) {
      setEmailError('Erro ao verificar email');
      return false;
    }
  };

  const handleSave = async () => {
    const isEmailValid = await validateEmail();
    if (!isEmailValid) return;

    updateProfile.mutate(
      {
        userId: user.id,
        name,
        email,
        role,
        isActive,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      }
    );
  };

  const handleResetPassword = () => {
    resetPassword.mutate(user.id, {
      onSuccess: (data) => {
        setTemporaryPassword(data.temporaryPassword);
      },
    });
  };

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasChanges =
    name !== user.name ||
    email !== user.email ||
    role !== user.role ||
    isActive !== user.is_active;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Perfil do Usuário</DialogTitle>
          <DialogDescription>
            Edite os dados cadastrais do usuário. Alterações de perfil (role) podem afetar as
            permissões de acesso.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do usuário"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError('');
              }}
              onBlur={validateEmail}
              placeholder="email@exemplo.com"
            />
            {emailError && <p className="text-sm text-destructive">{emailError}</p>}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label htmlFor="role">Perfil</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as AppRole)}
              disabled={isSelf || isTimeUser}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o perfil" />
              </SelectTrigger>
              <SelectContent>
                {roleOptions
                  .filter((opt) => !isTimeUser || opt.value === 'time')
                  .map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">
                Você não pode alterar seu próprio perfil
              </p>
            )}
            {isTimeUser && !isSelf && (
              <p className="text-xs text-muted-foreground">
                Usuários do tipo "Time" não podem ter o perfil alterado
              </p>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="status">Usuário ativo</Label>
              <p className="text-xs text-muted-foreground">
                Usuários inativos não conseguem fazer login
              </p>
            </div>
            <Switch
              id="status"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSelf}
            />
          </div>
          {isSelf && (
            <p className="text-xs text-muted-foreground">
              Você não pode desativar sua própria conta
            </p>
          )}

          {/* Password Reset Section */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Key className="w-4 h-4" />
                Redefinir Senha
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-3">
              {temporaryPassword ? (
                <div className="space-y-3">
                  <Alert>
                    <AlertDescription>
                      Nova senha gerada com sucesso! Copie e envie para o usuário.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2">
                    <Input
                      value={temporaryPassword}
                      readOnly
                      className="font-mono bg-muted"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyPassword}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O usuário deverá alterar a senha no primeiro acesso.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Gere uma nova senha temporária para o usuário.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={handleResetPassword}
                    disabled={resetPassword.isPending}
                  >
                    {resetPassword.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Redefinir Senha
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateProfile.isPending || !!emailError}
          >
            {updateProfile.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
