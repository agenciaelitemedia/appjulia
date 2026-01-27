import { TeamMember } from "../types";
import { EquipeMemberCard } from "./EquipeMemberCard";
import { Users } from "lucide-react";

interface EquipeGridProps {
  members: TeamMember[];
  isLoading: boolean;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
}

export function EquipeGrid({
  members,
  isLoading,
  onEdit,
  onDelete,
  onResetPassword,
}: EquipeGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="h-32 rounded-lg bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg">Nenhum membro encontrado</h3>
        <p className="text-muted-foreground mt-1">
          Clique em "Novo Membro" para adicionar alguém à sua equipe.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {members.map((member) => (
        <EquipeMemberCard
          key={member.id}
          member={member}
          onEdit={onEdit}
          onDelete={onDelete}
          onResetPassword={onResetPassword}
        />
      ))}
    </div>
  );
}
