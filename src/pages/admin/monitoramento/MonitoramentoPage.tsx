import { useState } from 'react';
import { Monitor } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { MonitoramentoUserList } from './components/MonitoramentoUserList';
import { MonitoramentoEditor } from './components/MonitoramentoEditor';
import { useUsersWithPermissions } from '../permissoes/hooks/usePermissionsAdmin';
import type { UserWithPermissions } from '../permissoes/types';

export default function MonitoramentoPage() {
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  const [roleFilter, setRoleFilter] = useState('colaborador');

  const { data: users = [], isLoading } = useUsersWithPermissions(
    roleFilter === 'all' ? undefined : roleFilter
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gerenciar Monitoramento</h1>
        <p className="text-muted-foreground">
          Vincule e gerencie os agentes monitorados por cada usuário.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <Card className="lg:col-span-1 overflow-hidden">
          <MonitoramentoUserList
            users={users}
            selectedUserId={selectedUser?.id ?? null}
            onSelectUser={setSelectedUser}
            roleFilter={roleFilter}
            onRoleFilterChange={setRoleFilter}
            isLoading={isLoading}
          />
        </Card>

        <div className="lg:col-span-2">
          {selectedUser ? (
            <MonitoramentoEditor key={selectedUser.id} user={selectedUser} />
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Monitor className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">Selecione um usuário</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Escolha um usuário na lista ao lado para visualizar e gerenciar seus agentes vinculados.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
