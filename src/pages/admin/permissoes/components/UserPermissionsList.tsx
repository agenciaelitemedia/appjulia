import { useState } from 'react';
import { Search, User, Star, Users, Key, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { UserWithPermissions } from '../types';
import { roleLabels } from '../types';
import type { AppRole } from '@/types/permissions';

interface UserPermissionsListProps {
  users: UserWithPermissions[];
  selectedUserId: number | null;
  onSelectUser: (user: UserWithPermissions) => void;
  roleFilter: string;
  onRoleFilterChange: (role: string) => void;
  isLoading: boolean;
}

export function UserPermissionsList({
  users,
  selectedUserId,
  onSelectUser,
  roleFilter,
  onRoleFilterChange,
  isLoading,
}: UserPermissionsListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getRoleBadgeVariant = (role: AppRole) => {
    switch (role) {
      case 'admin':
        return 'default';
      case 'colaborador':
        return 'secondary';
      case 'user':
        return 'outline';
      case 'time':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="space-y-3 p-4 border-b">
        <Select value={roleFilter} onValueChange={onRoleFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por cargo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os cargos</SelectItem>
            <SelectItem value="admin">Administrador</SelectItem>
            <SelectItem value="colaborador">Colaborador</SelectItem>
            <SelectItem value="user">Usuário</SelectItem>
            <SelectItem value="time">Time</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum usuário encontrado</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    selectedUserId === user.id
                      ? 'bg-primary/10 border border-primary/30'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate flex items-center gap-1">
                          {user.name}
                          {user.use_custom_permissions && (
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={getRoleBadgeVariant(user.role)} className="text-xs">
                        {roleLabels[user.role]}
                      </Badge>
                      {!user.is_active && (
                        <Badge variant="destructive" className="text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
