import { useState, useEffect } from 'react';
import { User, AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PermissionMatrix } from './PermissionMatrix';
import {
  useUserPermissions,
  useRoleDefaultPermissions,
  useUpdateUserPermissions,
} from '../hooks/usePermissionsAdmin';
import type { PermissionRow, UserWithPermissions } from '../types';
import { permissionToRow, roleLabels } from '../types';
import type { ModuleCode, PermissionUpdate } from '@/types/permissions';

interface UserPermissionEditorProps {
  user: UserWithPermissions;
}

export function UserPermissionEditor({ user }: UserPermissionEditorProps) {
  const [useCustom, setUseCustom] = useState(user.use_custom_permissions);
  const [editedPermissions, setEditedPermissions] = useState<PermissionRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: userPermissions, isLoading: loadingUserPerms } = useUserPermissions(user.id);
  const { data: roleDefaults, isLoading: loadingDefaults } = useRoleDefaultPermissions(user.role);
  const updateMutation = useUpdateUserPermissions();

  const isAdmin = user.role === 'admin';
  const isTimeUser = user.role === 'time';

  // Initialize permissions when data loads
  useEffect(() => {
    if (userPermissions) {
      setEditedPermissions(userPermissions.map(permissionToRow));
      setUseCustom(user.use_custom_permissions);
      setHasChanges(false);
    }
  }, [userPermissions, user.use_custom_permissions]);

  // Switch to role defaults when custom is disabled
  useEffect(() => {
    if (!useCustom && roleDefaults) {
      setEditedPermissions(roleDefaults.map(permissionToRow));
    } else if (useCustom && userPermissions) {
      setEditedPermissions(userPermissions.map(permissionToRow));
    }
  }, [useCustom, roleDefaults, userPermissions]);

  const handlePermissionChange = (
    moduleCode: ModuleCode,
    field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete',
    value: boolean
  ) => {
    setEditedPermissions((prev) =>
      prev.map((p) => (p.moduleCode === moduleCode ? { ...p, [field]: value } : p))
    );
    setHasChanges(true);
  };

  const handleCustomToggle = (checked: boolean) => {
    setUseCustom(checked);
    setHasChanges(true);
  };

  const handleReset = () => {
    if (roleDefaults) {
      setEditedPermissions(roleDefaults.map(permissionToRow));
      setUseCustom(false);
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    const permissions: PermissionUpdate[] = editedPermissions.map((p) => ({
      moduleCode: p.moduleCode,
      canView: p.canView,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    }));

    updateMutation.mutate({
      userId: user.id,
      permissions,
      useCustom,
    });
    setHasChanges(false);
  };

  const isLoading = loadingUserPerms || loadingDefaults;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-lg">{user.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <Badge variant="secondary" className="text-sm">
            {roleLabels[user.role]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-auto p-4 space-y-4">
        {/* Alerts */}
        {isAdmin && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Usuários administradores possuem acesso total ao sistema. As permissões não podem
              ser alteradas.
            </AlertDescription>
          </Alert>
        )}

        {isTimeUser && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Usuários do tipo "Time" herdam permissões do usuário principal. As permissões são
              limitadas aos agentes vinculados.
            </AlertDescription>
          </Alert>
        )}

        {/* Custom toggle */}
        {!isAdmin && (
          <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch
                id="use-custom"
                checked={useCustom}
                onCheckedChange={handleCustomToggle}
              />
              <Label htmlFor="use-custom" className="cursor-pointer">
                Usar permissões customizadas
              </Label>
            </div>
            {useCustom && (
              <Badge variant="secondary">
                Customizado
              </Badge>
            )}
            {!useCustom && (
              <Badge variant="outline">
                Padrão do Cargo
              </Badge>
            )}
          </div>
        )}

        {/* Permission Matrix */}
        {isLoading ? (
          <div className="h-64 rounded-lg bg-muted animate-pulse" />
        ) : (
          <PermissionMatrix
            permissions={editedPermissions}
            onPermissionChange={handlePermissionChange}
            readOnly={isAdmin}
            disabled={!useCustom && !isAdmin}
          />
        )}
      </CardContent>

      {/* Actions */}
      {!isAdmin && (
        <div className="border-t p-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={handleReset} disabled={updateMutation.isPending}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Resetar para Padrão
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Salvando...' : 'Salvar Permissões'}
          </Button>
        </div>
      )}
    </Card>
  );
}
