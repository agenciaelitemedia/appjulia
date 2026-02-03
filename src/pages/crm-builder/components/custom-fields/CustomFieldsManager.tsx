import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  Plus, 
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Settings2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCRMCustomFields, type CRMCustomField, type CRMCustomFieldFormData } from '../../hooks/useCRMCustomFields';
import { CreateCustomFieldDialog } from './CreateCustomFieldDialog';
import { FIELD_TYPE_CONFIG } from './DynamicFieldRenderer';

interface CustomFieldsManagerProps {
  boardId: string;
  codAgent: string;
}

export function CustomFieldsManager({ boardId, codAgent }: CustomFieldsManagerProps) {
  const {
    fields,
    isLoading,
    createField,
    updateField,
    deleteField,
  } = useCRMCustomFields({ boardId, codAgent });

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingField, setEditingField] = useState<CRMCustomField | null>(null);
  const [deletingField, setDeletingField] = useState<CRMCustomField | null>(null);

  const handleCreate = async (data: CRMCustomFieldFormData) => {
    return await createField(data);
  };

  const handleEdit = async (data: CRMCustomFieldFormData) => {
    if (!editingField) return null;
    const success = await updateField(editingField.id, data);
    if (success) {
      setEditingField(null);
      return editingField;
    }
    return null;
  };

  const handleDelete = async () => {
    if (!deletingField) return;
    await deleteField(deletingField.id);
    setDeletingField(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Campos Customizados
          </CardTitle>
          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Campo
          </Button>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum campo customizado</p>
              <p className="text-xs mt-1">
                Crie campos personalizados para capturar dados específicos dos seus deals
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2">
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{field.field_label}</span>
                        {field.is_required && (
                          <Badge variant="outline" className="text-xs">
                            Obrigatório
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">
                          {FIELD_TYPE_CONFIG[field.field_type]?.label || field.field_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono">
                          {field.field_name}
                        </span>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingField(field)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => setDeletingField(field)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <CreateCustomFieldDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSubmit={handleCreate}
      />

      {/* Edit Dialog */}
      <CreateCustomFieldDialog
        open={!!editingField}
        onOpenChange={(open) => !open && setEditingField(null)}
        onSubmit={handleEdit}
        editField={editingField}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingField} onOpenChange={(open) => !open && setDeletingField(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo?</AlertDialogTitle>
            <AlertDialogDescription>
              O campo "{deletingField?.field_label}" será removido permanentemente.
              Os dados já salvos nos deals serão mantidos, mas não serão mais exibidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
