import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Database, Loader2 } from 'lucide-react';
import { ModulesList } from './components/ModulesList';
import { ModuleDialog } from './components/ModuleDialog';
import { useModulesAdmin, type ModuleFormData } from './hooks/useModulesAdmin';

export default function ModulosPage() {
  const {
    modules,
    isLoading,
    selectedModule,
    isDialogOpen,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    createModule,
    updateModule,
    deleteModule,
    migrateSchema,
    isCreating,
    isUpdating,
    isDeleting,
    isMigrating,
  } = useModulesAdmin();

  const handleSave = (data: ModuleFormData) => {
    if (selectedModule) {
      updateModule({ moduleId: selectedModule.id, moduleData: data });
    } else {
      createModule(data);
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gerenciamento de Módulos</h1>
          <p className="text-muted-foreground">
            Configure os módulos do sistema e suas permissões
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => migrateSchema()} disabled={isMigrating}>
            {isMigrating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            Migrar Schema
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Módulo
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Módulos do Sistema</CardTitle>
          <CardDescription>
            Lista de todos os módulos cadastrados. Use o botão "Migrar Schema" para adicionar os
            campos necessários ao menu dinâmico.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ModulesList
              modules={modules}
              onEdit={openEditDialog}
              onDelete={deleteModule}
              isDeleting={isDeleting}
            />
          )}
        </CardContent>
      </Card>

      <ModuleDialog
        open={isDialogOpen}
        onClose={closeDialog}
        module={selectedModule}
        onSave={handleSave}
        isLoading={isCreating || isUpdating}
      />
    </div>
  );
}
