import { useState } from 'react';
import { Shield } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PermissoesHeader } from './components/PermissoesHeader';
import { UserPermissionsList } from './components/UserPermissionsList';
import { UserPermissionEditor } from './components/UserPermissionEditor';
import { RoleDefaultsDialog } from './components/RoleDefaultsDialog';
import { useUsersWithPermissions } from './hooks/usePermissionsAdmin';
import type { UserWithPermissions } from './types';

export default function PermissoesPage() {
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [roleFilter, setRoleFilter] = useState('colaborador');
  const [showDefaultsDialog, setShowDefaultsDialog] = useState(false);

  const { data: users = [], isLoading } = useUsersWithPermissions(
    roleFilter === 'all' ? undefined : roleFilter
  );

  const handleSelectUser = (user: UserWithPermissions) => {
    setSelectedUser(user);
  };

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
  };

  return (
    <div className="space-y-6">
      <PermissoesHeader onEditDefaults={() => setShowDefaultsDialog(true)} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {/* Left Column - Users List */}
        <Card className="lg:col-span-1 overflow-hidden">
          <UserPermissionsList
            users={users}
            selectedUserId={selectedUser?.id ?? null}
            onSelectUser={handleSelectUser}
            roleFilter={roleFilter}
            onRoleFilterChange={handleRoleFilterChange}
            isLoading={isLoading}
          />
        </Card>

        {/* Right Column - Permission Editor */}
        <div className="lg:col-span-2">
          {selectedUser ? (
            <UserPermissionEditor key={selectedUser.id} user={selectedUser} />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Selecione um usuário</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Escolha um usuário na lista ao lado para visualizar e editar suas permissões de
                  acesso aos módulos do sistema.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      <RoleDefaultsDialog open={showDefaultsDialog} onOpenChange={setShowDefaultsDialog} />
    </div>
  );
}
