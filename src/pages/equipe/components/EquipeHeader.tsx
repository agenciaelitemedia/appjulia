import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

interface EquipeHeaderProps {
  onNewMember: () => void;
}

export function EquipeHeader({ onNewMember }: EquipeHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Equipe</h1>
        <p className="text-muted-foreground">
          Gerencie os membros da sua equipe
        </p>
      </div>
      <Button onClick={onNewMember} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Novo Membro
      </Button>
    </div>
  );
}
