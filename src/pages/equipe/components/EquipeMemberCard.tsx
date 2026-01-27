import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Bot, KeyRound } from "lucide-react";
import { TeamMember } from "../types";

interface EquipeMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
}

export function EquipeMemberCard({
  member,
  onEdit,
  onDelete,
  onResetPassword,
}: EquipeMemberCardProps) {
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{member.name}</h3>
            <p className="text-sm text-muted-foreground truncate">
              {member.email}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Bot className="h-3 w-3" />
                {member.agents_count}{" "}
                {member.agents_count === 1 ? "agente" : "agentes"}
              </Badge>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(member)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onResetPassword(member)}>
                <KeyRound className="h-4 w-4 mr-2" />
                Redefinir Senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(member)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
