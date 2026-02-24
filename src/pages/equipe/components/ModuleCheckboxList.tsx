import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Layers } from "lucide-react";
import { UserPermission } from "@/types/permissions";

interface ModuleCheckboxListProps {
  parentPermissions: UserPermission[];
  selectedModuleCodes: string[];
  onChange: (codes: string[]) => void;
  isLoading?: boolean;
}

const categoryLabels: Record<string, string> = {
  principal: 'Principal',
  crm: 'CRM',
  agente: 'Agente',
  sistema: 'Sistema',
  admin: 'Administrativo',
  financeiro: 'Financeiro',
};

// Modules not available for TIME role
const excludedModules = ['team', 'settings'];

export function ModuleCheckboxList({
  parentPermissions,
  selectedModuleCodes,
  onChange,
  isLoading,
}: ModuleCheckboxListProps) {
  // Filter valid modules: parent has access, not excluded, in allowed category
  const validModules = parentPermissions.filter(
    (m) =>
      m.can_view &&
      !excludedModules.includes(m.module_code) &&
      allowedCategories.includes(m.category)
  );

  // Group by category
  const groupedModules = validModules.reduce((acc, mod) => {
    if (!acc[mod.category]) acc[mod.category] = [];
    acc[mod.category].push(mod);
    return acc;
  }, {} as Record<string, UserPermission[]>);

  const handleToggle = (moduleCode: string) => {
    if (selectedModuleCodes.includes(moduleCode)) {
      onChange(selectedModuleCodes.filter((c) => c !== moduleCode));
    } else {
      onChange([...selectedModuleCodes, moduleCode]);
    }
  };

  const handleSelectAll = () => {
    if (selectedModuleCodes.length === validModules.length) {
      onChange([]);
    } else {
      onChange(validModules.map((m) => m.module_code));
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-10 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (validModules.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>Nenhum módulo disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Select All */}
      <div className="flex items-center gap-2 pb-2 border-b">
        <Checkbox
          id="select-all-modules"
          checked={selectedModuleCodes.length === validModules.length && validModules.length > 0}
          onCheckedChange={handleSelectAll}
        />
        <Label htmlFor="select-all-modules" className="text-sm font-medium cursor-pointer">
          Selecionar todos ({validModules.length})
        </Label>
      </div>

      {/* Grouped Modules */}
      <div className="max-h-60 overflow-y-auto space-y-4">
        {Object.entries(groupedModules).map(([category, modules]) => (
          <div key={category} className="space-y-2">
            <h4 className="font-semibold text-xs uppercase text-muted-foreground tracking-wide">
              {categoryLabels[category] || category}
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {modules.map((mod) => (
                <div
                  key={mod.module_code}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <Checkbox
                    id={`module-${mod.module_code}`}
                    checked={selectedModuleCodes.includes(mod.module_code)}
                    onCheckedChange={() => handleToggle(mod.module_code)}
                  />
                  <Label
                    htmlFor={`module-${mod.module_code}`}
                    className="flex-1 cursor-pointer text-sm"
                  >
                    {mod.module_name}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
