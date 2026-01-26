import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { UserCircle, Mail, Lock, Copy, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAgentUpdate } from '../../hooks/useAgentUpdate';
import type { EditAgentFormData } from './EditClientStep';

export function EditUserStep() {
  const { watch, setValue } = useFormContext<EditAgentFormData>();
  const { resetPassword, isResettingPassword } = useAgentUpdate();
  
  const userId = watch('user_id');
  const userName = watch('user_name');
  const userEmail = watch('user_email');
  const rememberToken = watch('remember_token');
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const passwordToShow = rememberToken;
  const hasPassword = Boolean(passwordToShow);

  const handleCopyPassword = () => {
    if (passwordToShow) {
      navigator.clipboard.writeText(passwordToShow);
      toast.success('Senha copiada para a área de transferência');
    }
  };

  const handleCopyNewPassword = () => {
    if (newPassword) {
      navigator.clipboard.writeText(newPassword);
      toast.success('Nova senha copiada para a área de transferência');
    }
  };

  const handleResetPassword = async () => {
    if (!userId) return;
    
    setShowConfirmDialog(false);
    
    const result = await resetPassword(userId);
    
    if (result.success && result.newPassword) {
      setNewPassword(result.newPassword);
      setValue('remember_token', result.newPassword);
      setShowPasswordDialog(true);
    } else {
      toast.error(result.error || 'Erro ao resetar senha');
    }
  };

  if (!userId) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Dados de Acesso</h3>
          <p className="text-sm text-muted-foreground">
            Informações do usuário vinculado ao agente
          </p>
        </div>
        
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhum usuário vinculado a este agente
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground">Dados de Acesso</h3>
        <p className="text-sm text-muted-foreground">
          Informações do usuário vinculado ao agente (somente leitura)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-5 w-5" />
            Usuário Vinculado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* User Name */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <UserCircle className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{userName || '-'}</p>
              </div>
            </div>
          </div>

          {/* User Email */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">E-mail</p>
                <p className="font-medium">{userEmail || '-'}</p>
              </div>
            </div>
          </div>

          {/* Password */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Senha</p>
                <p className="font-mono font-medium">
                  {hasPassword ? passwordToShow : '••••••••••'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasPassword && (
                <Button variant="ghost" size="sm" onClick={handleCopyPassword}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowConfirmDialog(true)}
                disabled={isResettingPassword}
              >
                {isResettingPassword ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Resetar Senha
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="p-4 bg-secondary/50 border border-border rounded-lg">
        <p className="text-sm text-secondary-foreground">
          <strong>Nota:</strong> Os dados do usuário não podem ser alterados nesta tela. 
          Para editar o usuário, utilize a área de gerenciamento de usuários.
        </p>
      </div>

      {/* Confirm Reset Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetar Senha</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja gerar uma nova senha para este usuário?
              A senha atual será substituída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>
              Confirmar Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Senha Gerada</DialogTitle>
            <DialogDescription>
              A senha do usuário foi resetada. Anote a nova senha:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <code className="text-lg font-mono font-semibold">{newPassword}</code>
              <Button variant="outline" size="sm" onClick={handleCopyNewPassword}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Esta senha foi salva no sistema. Recomendamos que o usuário altere a senha no primeiro acesso.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPasswordDialog(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
