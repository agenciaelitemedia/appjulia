import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PermissionMatrix } from './PermissionMatrix';
import {
  useRoleDefaultPermissions,
  useUpdateRoleDefaultPermissions,
} from '../hooks/usePermissionsAdmin';
import type { PermissionRow } from '../types';
import { permissionToRow, roleLabels } from '../types';
import type { AppRole, ModuleCode, PermissionUpdate } from '@/types/permissions';

interface RoleDefaultsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const editableRoles: AppRole[] = ['colaborador', 'user', 'time'];

export function RoleDefaultsDialog({ open, onOpenChange }: RoleDefaultsDialogProps) {
  const [selectedRole, setSelectedRole] = useState<AppRole>('colaborador');
  const [editedPermissions, setEditedPermissions] = useState<PermissionRow[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: roleDefaults, isLoading } = useRoleDefaultPermissions(selectedRole);
  const updateMutation = useUpdateRoleDefaultPermissions();

  // Initialize permissions when data loads
  useEffect(() => {
    if (roleDefaults) {
      setEditedPermissions(roleDefaults.map(permissionToRow));
      setHasChanges(false);
    }
  }, [roleDefaults]);

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

  const handleRoleChange = (role: string) => {
    setSelectedRole(role as AppRole);
    setHasChanges(false);
  };

  const handleSave = () => {
    const permissions: PermissionUpdate[] = editedPermissions.map((p) => ({
      moduleCode: p.moduleCode,
      canView: p.canView,
      canCreate: p.canCreate,
      canEdit: p.canEdit,
      canDelete: p.canDelete,
    }));

    updateMutation.mutate(
      {
        role: selectedRole,
        permissions,
      },
      {
        onSuccess: () => {
          setHasChanges(false);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Editar Permissões Padrão</DialogTitle>
          <DialogDescription>
            Configure as permissões padrão para cada cargo. Usuários que não possuem permissões
            customizadas herdarão estas configurações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-auto">
          <div className="space-y-2">
            <Label>Selecionar Cargo</Label>
            <Select value={selectedRole} onValueChange={handleRoleChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {editableRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Nota: Administradores sempre possuem acesso total e não podem ser editados.
            </p>
          </div>

          {isLoading ? (
            <div className="h-64 rounded-lg bg-muted animate-pulse" />
          ) : (
            <PermissionMatrix
              permissions={editedPermissions}
              onPermissionChange={handlePermissionChange}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || updateMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Salvando...' : 'Salvar Permissões Padrão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
