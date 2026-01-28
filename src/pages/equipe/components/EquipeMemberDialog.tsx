import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";
import { TeamMember } from "../types";
import { AgentCheckboxList, SelectedAgent } from "./AgentCheckboxList";
import { ModuleCheckboxList } from "./ModuleCheckboxList";
import {
  usePrincipalUserAgents,
  useParentUserPermissions,
  useCreateTeamMember,
  useUpdateTeamMember,
} from "../hooks/useEquipeData";
import { externalDb } from "@/lib/externalDb";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface EquipeMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onSuccess?: () => void;
}

export function EquipeMemberDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: EquipeMemberDialogProps) {
  const { user } = useAuth();
  const isEditing = !!member;

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [principalUserId, setPrincipalUserId] = useState<number | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<SelectedAgent[]>([]);
  const [selectedModuleCodes, setSelectedModuleCodes] = useState<string[]>([]);
  const [emailError, setEmailError] = useState("");
  const [isValidatingEmail, setIsValidatingEmail] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Data hooks - load agents for logged-in user
  const { data: agents = [], isLoading: loadingAgents } =
    usePrincipalUserAgents(principalUserId);

  // Load parent permissions
  const { data: parentPermissions = [], isLoading: loadingPermissions } =
    useParentUserPermissions(principalUserId);

  // Mutations
  const createMember = useCreateTeamMember();
  const updateMember = useUpdateTeamMember();

  // Initialize form
  useEffect(() => {
    if (open) {
      if (member) {
        setName(member.name);
        setEmail(member.email);
        setPrincipalUserId(member.user_id);
        // Load member's current agents and modules
        loadMemberData(member.id);
      } else {
        setName("");
        setEmail("");
        // Always use logged-in user as the principal
        setPrincipalUserId(user?.id || null);
        setSelectedAgents([]);
        setSelectedModuleCodes([]);
      }
      setEmailError("");
      setTemporaryPassword(null);
      setCopied(false);
    }
  }, [open, member, user?.id]);

  // Load member's existing agents and modules when editing
  const loadMemberData = async (memberId: number) => {
    try {
      // Load agents
      const memberAgents = await externalDb.getTeamMemberAgents(memberId);
      setSelectedAgents(
        memberAgents.map((a: any) => ({
          agentId: a.agent_id,
          codAgent: a.cod_agent,
        }))
      );

      // Load modules
      const memberPermissions = await externalDb.getUserPermissions(memberId);
      const activeCodes = memberPermissions
        .filter((p) => p.can_view)
        .map((p) => p.module_code);
      setSelectedModuleCodes(activeCodes);
    } catch (error) {
      console.error("Error loading member data:", error);
    }
  };

  // When principal user changes, reset selections (unless editing)
  useEffect(() => {
    if (!isEditing) {
      setSelectedAgents([]);
      setSelectedModuleCodes([]);
    }
  }, [principalUserId, isEditing]);

  // Validate email on blur
  const validateEmail = async () => {
    if (!email || email === member?.email) {
      setEmailError("");
      return true;
    }

    setIsValidatingEmail(true);
    try {
      const result = await externalDb.checkUserEmailExists(email);
      if (result.exists) {
        setEmailError("Este email já está em uso");
        return false;
      }
      setEmailError("");
      return true;
    } catch (error) {
      console.error("Error validating email:", error);
      return true;
    } finally {
      setIsValidatingEmail(false);
    }
  };

  const handleSubmit = async () => {
    // Validations
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!email.trim()) {
      toast.error("Email é obrigatório");
      return;
    }

    if (!principalUserId) {
      toast.error("Selecione o usuário principal");
      return;
    }

    const isEmailValid = await validateEmail();
    if (!isEmailValid) {
      return;
    }

    // Build module permissions
    const modulePermissions = selectedModuleCodes.map((code) => ({
      moduleCode: code,
    }));

    try {
      if (isEditing) {
        await updateMember.mutateAsync({
          memberId: member.id,
          name,
          principalUserId,
          agentIds: selectedAgents,
          modulePermissions,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        const result = await createMember.mutateAsync({
          name,
          email,
          principalUserId,
          agentIds: selectedAgents,
          modulePermissions,
        });
        setTemporaryPassword(result.temporaryPassword);
      }
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
    if (temporaryPassword) {
      // Close after showing password
      setTemporaryPassword(null);
      onOpenChange(false);
      onSuccess?.();
    } else {
      onOpenChange(false);
    }
  };

  const isSubmitting = createMember.isPending || updateMember.isPending;

  // Success state - show temporary password
  if (temporaryPassword) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Membro criado com sucesso!</DialogTitle>
            <DialogDescription>
              Um novo usuário foi criado para a equipe. Anote a senha temporária abaixo:
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Membro" : "Novo Membro da Equipe"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações e permissões do membro."
              : "Preencha os dados para criar um novo membro da equipe."}
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
              placeholder="Nome do membro"
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
                setEmailError("");
              }}
              onBlur={validateEmail}
              placeholder="email@exemplo.com"
              disabled={isEditing}
            />
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
            {isValidatingEmail && (
              <p className="text-sm text-muted-foreground">Validando email...</p>
            )}
          </div>

          {/* Agents */}
          {principalUserId && (
            <div className="space-y-2">
              <Label>Agentes com Acesso</Label>
              <AgentCheckboxList
                agents={agents}
                selectedAgents={selectedAgents}
                onChange={setSelectedAgents}
                isLoading={loadingAgents}
              />
            </div>
          )}

          {/* Modules */}
          {principalUserId && (
            <div className="space-y-2">
              <Label>Módulos com Acesso</Label>
              <ModuleCheckboxList
                parentPermissions={parentPermissions}
                selectedModuleCodes={selectedModuleCodes}
                onChange={setSelectedModuleCodes}
                isLoading={loadingPermissions}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditing ? "Salvar" : "Criar Membro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
