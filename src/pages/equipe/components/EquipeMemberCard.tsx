import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MoreVertical, Pencil, Trash2, Bot, KeyRound, Layers, Key, Copy, Check } from "lucide-react";
import { TeamMember } from "../types";
import { externalDb } from "@/lib/externalDb";
import { UserPermission } from "@/types/permissions";

interface EquipeMemberCardProps {
  member: TeamMember;
  onEdit: (member: TeamMember) => void;
  onDelete: (member: TeamMember) => void;
  onResetPassword: (member: TeamMember) => void;
}

// Category labels for display
const categoryLabels: Record<string, string> = {
  principal: 'Principal',
  crm: 'CRM',
  agente: 'Agente',
  sistema: 'Sistema',
};

// Only show these categories (exclude admin/financeiro)
const allowedCategories = ['principal', 'crm', 'agente', 'sistema'];

export function EquipeMemberCard({
  member,
  onEdit,
  onDelete,
  onResetPassword,
}: EquipeMemberCardProps) {
  const [copied, setCopied] = useState(false);
  
  const initials = member.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleCopyPassword = () => {
    if (member.remember_token) {
      navigator.clipboard.writeText(member.remember_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch member's modules
  const { data: permissions = [] } = useQuery({
    queryKey: ["member-permissions", member.id],
    queryFn: () => externalDb.getUserPermissions(member.id),
  });

  // Filter to only modules with can_view and allowed categories
  const activeModules = permissions.filter(
    (p: UserPermission) =>
      p.can_view &&
      allowedCategories.includes(p.category) &&
      p.module_code !== 'team' &&
      p.module_code !== 'settings'
  );

  // Group modules by category for tooltip
  const groupedModules = activeModules.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod.module_name);
    return acc;
  }, {} as Record<string, string[]>);

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

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="gap-1">
                <Bot className="h-3 w-3" />
                {member.agents_count}{" "}
                {member.agents_count === 1 ? "agente" : "agentes"}
              </Badge>

              {/* Modules Badge with Tooltip */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="gap-1 cursor-help">
                      <Layers className="h-3 w-3" />
                      {activeModules.length}{" "}
                      {activeModules.length === 1 ? "módulo" : "módulos"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    {activeModules.length === 0 ? (
                      <p className="text-sm">Nenhum módulo atribuído</p>
                    ) : (
                      <div className="space-y-2 text-sm">
                        {Object.entries(groupedModules).map(([category, modules]) => (
                          <div key={category}>
                            <p className="font-semibold text-xs uppercase text-muted-foreground">
                              {categoryLabels[category] || category}
                            </p>
                            <p>{(modules as string[]).join(", ")}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Password Badge */}
              {member.remember_token && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className="gap-1 cursor-pointer hover:bg-accent"
                        onClick={handleCopyPassword}
                      >
                        <Key className="h-3 w-3" />
                        {member.remember_token}
                        {copied ? (
                          <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p className="text-sm">Clique para copiar a senha</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
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
            <DropdownMenuContent align="end" className="bg-popover">
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
