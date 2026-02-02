import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2 } from 'lucide-react';
import { getIcon } from '@/lib/iconMap';
import type { Module } from '@/types/permissions';

interface ModulesListProps {
  modules: Module[];
  onEdit: (module: Module) => void;
  onDelete: (moduleId: number) => void;
  isDeleting: boolean;
}

export function ModulesList({ modules, onEdit, onDelete, isDeleting }: ModulesListProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">Ícone</TableHead>
            <TableHead>Código</TableHead>
            <TableHead>Nome</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Grupo Menu</TableHead>
            <TableHead>Rota</TableHead>
            <TableHead className="text-center">Ordem</TableHead>
            <TableHead className="text-center">Menu</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((module) => {
            const Icon = getIcon(module.icon);
            return (
              <TableRow key={module.id}>
                <TableCell>
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4" />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-sm">{module.code}</TableCell>
                <TableCell className="font-medium">{module.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {module.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {module.menu_group || '-'}
                </TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {module.route || '-'}
                </TableCell>
                <TableCell className="text-center">{module.display_order}</TableCell>
                <TableCell className="text-center">
                  {module.is_menu_visible ? (
                    <Badge variant="secondary">Sim</Badge>
                  ) : (
                    <Badge variant="outline">Não</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {module.is_active ? (
                    <Badge variant="default">Ativo</Badge>
                  ) : (
                    <Badge variant="destructive">Inativo</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(module)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    {module.is_active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(module.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {modules.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                Nenhum módulo encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
