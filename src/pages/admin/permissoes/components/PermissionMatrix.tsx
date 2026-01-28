import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { PermissionRow } from '../types';
import { categoryLabels, categoryColors } from '../types';
import type { ModuleCategory, ModuleCode } from '@/types/permissions';

interface PermissionMatrixProps {
  permissions: PermissionRow[];
  onPermissionChange?: (
    moduleCode: ModuleCode,
    field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete',
    value: boolean
  ) => void;
  readOnly?: boolean;
  disabled?: boolean;
}

export function PermissionMatrix({
  permissions,
  onPermissionChange,
  readOnly = false,
  disabled = false,
}: PermissionMatrixProps) {
  // Group by category
  const grouped = permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    },
    {} as Record<ModuleCategory, PermissionRow[]>
  );

  const categoryOrder: ModuleCategory[] = [
    'principal',
    'crm',
    'agente',
    'sistema',
    'admin',
    'financeiro',
  ];

  const handleChange = (
    moduleCode: ModuleCode,
    field: 'canView' | 'canCreate' | 'canEdit' | 'canDelete',
    checked: boolean
  ) => {
    if (onPermissionChange && !readOnly && !disabled) {
      onPermissionChange(moduleCode, field, checked);
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left p-3 font-medium">Módulo</th>
            <th className="text-center p-3 font-medium w-20">Ver</th>
            <th className="text-center p-3 font-medium w-20">Criar</th>
            <th className="text-center p-3 font-medium w-20">Editar</th>
            <th className="text-center p-3 font-medium w-20">Excluir</th>
          </tr>
        </thead>
        <tbody>
          {categoryOrder.map((category) => {
            const categoryPerms = grouped[category];
            if (!categoryPerms || categoryPerms.length === 0) return null;

            return (
              <>
                <tr key={`cat-${category}`} className="bg-muted/30">
                  <td colSpan={5} className="p-2">
                    <Badge variant="outline" className={cn('text-xs', categoryColors[category])}>
                      {categoryLabels[category]}
                    </Badge>
                  </td>
                </tr>
                {categoryPerms.map((perm) => (
                  <tr
                    key={perm.moduleCode}
                    className="border-t border-border/50 hover:bg-muted/20"
                  >
                    <td className="p-3">
                      <span className="font-medium">{perm.moduleName}</span>
                    </td>
                    <td className="text-center p-3">
                      <Checkbox
                        checked={perm.canView}
                        onCheckedChange={(checked) =>
                          handleChange(perm.moduleCode, 'canView', !!checked)
                        }
                        disabled={readOnly || disabled}
                        className="mx-auto"
                      />
                    </td>
                    <td className="text-center p-3">
                      <Checkbox
                        checked={perm.canCreate}
                        onCheckedChange={(checked) =>
                          handleChange(perm.moduleCode, 'canCreate', !!checked)
                        }
                        disabled={readOnly || disabled}
                        className="mx-auto"
                      />
                    </td>
                    <td className="text-center p-3">
                      <Checkbox
                        checked={perm.canEdit}
                        onCheckedChange={(checked) =>
                          handleChange(perm.moduleCode, 'canEdit', !!checked)
                        }
                        disabled={readOnly || disabled}
                        className="mx-auto"
                      />
                    </td>
                    <td className="text-center p-3">
                      <Checkbox
                        checked={perm.canDelete}
                        onCheckedChange={(checked) =>
                          handleChange(perm.moduleCode, 'canDelete', !!checked)
                        }
                        disabled={readOnly || disabled}
                        className="mx-auto"
                      />
                    </td>
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
