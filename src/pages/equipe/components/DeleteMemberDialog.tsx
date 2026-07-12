import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TeamMember } from "../types";
import { useDeleteTeamMember } from "../hooks/useEquipeData";
import { Loader2 } from "lucide-react";

interface DeleteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  onSuccess?: () => void;
}

export function DeleteMemberDialog({
  open,
  onOpenChange,
  member,
  onSuccess,
}: DeleteMemberDialogProps) {
  const deleteMember = useDeleteTeamMember();

  const handleDelete = async () => {
    if (!member) return;

    try {
      await deleteMember.mutateAsync({ id: member.id, name: member.name });
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      // Error handled in mutation
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover membro?</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja remover <strong>{member?.name}</strong> da
            equipe? Esta ação não pode ser desfeita e o membro perderá acesso
            aos agentes.
          </AlertDialogDescription>
          <AlertDialogDescription className="mt-2 text-xs">
            Conversas em aberto/pendentes atribuídas a este membro voltarão
            para a fila (sem responsável). Conversas resolvidas serão
            encerradas automaticamente.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMember.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteMember.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMember.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Remover
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
