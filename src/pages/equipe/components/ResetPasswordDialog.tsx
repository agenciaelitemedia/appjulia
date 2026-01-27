import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, KeyRound } from "lucide-react";
import { TeamMember } from "../types";
import { useResetTeamMemberPassword } from "../hooks/useEquipeData";
import { toast } from "sonner";

interface ResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  member,
}: ResetPasswordDialogProps) {
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetPassword = useResetTeamMemberPassword();

  const handleReset = async () => {
    if (!member) return;

    try {
      const result = await resetPassword.mutateAsync(member.id);
      setTemporaryPassword(result.temporaryPassword);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const handleCopyPassword = () => {
    if (temporaryPassword) {
      navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Senha copiada!");
    }
  };

  const handleClose = () => {
    setTemporaryPassword(null);
    setCopied(false);
    onOpenChange(false);
  };

  // Success state - show new password
  if (temporaryPassword) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Senha redefinida com sucesso!</DialogTitle>
            <DialogDescription>
              Uma nova senha foi gerada para {member?.name}. Anote a senha temporária abaixo:
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <code className="text-lg font-mono font-semibold">{temporaryPassword}</code>
              <Button variant="outline" size="sm" onClick={handleCopyPassword}>
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Esta senha será salva no campo "remember_token" do usuário. 
              Recomendamos que o usuário altere a senha no primeiro acesso.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>
              Entendi, continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Redefinir Senha
          </DialogTitle>
          <DialogDescription>
            Uma nova senha temporária será gerada para este membro.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja redefinir a senha de{" "}
            <span className="font-medium text-foreground">{member?.name}</span>?
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            O membro precisará usar a nova senha para acessar o sistema.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={resetPassword.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleReset} disabled={resetPassword.isPending}>
            {resetPassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Redefinir Senha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
