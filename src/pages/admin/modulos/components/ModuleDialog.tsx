import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { availableIcons, getIcon } from '@/lib/iconMap';
import type { Module } from '@/types/permissions';
import type { ModuleFormData } from '../hooks/useModulesAdmin';

const moduleSchema = z.object({
  code: z.string().min(2, 'Código deve ter pelo menos 2 caracteres'),
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  category: z.string().min(1, 'Categoria é obrigatória'),
  icon: z.string().optional(),
  route: z.string().optional(),
  menu_group: z.string().optional(),
  is_menu_visible: z.boolean(),
  display_order: z.number().min(0),
  is_active: z.boolean(),
});

interface ModuleDialogProps {
  open: boolean;
  onClose: () => void;
  module: Module | null;
  onSave: (data: ModuleFormData) => void;
  isLoading: boolean;
}

const categories = [
  { value: 'principal', label: 'Principal' },
  { value: 'crm', label: 'CRM' },
  { value: 'agente', label: 'Agente' },
  { value: 'sistema', label: 'Sistema' },
  { value: 'admin', label: 'Administrativo' },
  { value: 'financeiro', label: 'Financeiro' },
];

const menuGroups = [
  { value: 'PRINCIPAL', label: 'Principal' },
  { value: 'AGENTES DA JULIA', label: 'Agentes da Julia' },
  { value: 'CRM', label: 'CRM' },
  { value: 'SISTEMA', label: 'Sistema' },
  { value: 'ADMINISTRATIVO', label: 'Administrativo' },
  { value: 'FINANCEIRO', label: 'Financeiro' },
  { value: 'CONFIGURAÇÕES', label: 'Configurações' },
];

export function ModuleDialog({ open, onClose, module, onSave, isLoading }: ModuleDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ModuleFormData>({
    resolver: zodResolver(moduleSchema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      category: 'sistema',
      icon: 'Layers',
      route: '',
      menu_group: 'SISTEMA',
      is_menu_visible: true,
      display_order: 0,
      is_active: true,
    },
  });

  const selectedIcon = watch('icon');
  const IconComponent = getIcon(selectedIcon);

  useEffect(() => {
    if (module) {
      reset({
        code: module.code,
        name: module.name,
        description: module.description || '',
        category: module.category,
        icon: module.icon || 'Layers',
        route: module.route || '',
        menu_group: module.menu_group || 'SISTEMA',
        is_menu_visible: module.is_menu_visible ?? true,
        display_order: module.display_order || 0,
        is_active: module.is_active ?? true,
      });
    } else {
      reset({
        code: '',
        name: '',
        description: '',
        category: 'sistema',
        icon: 'Layers',
        route: '',
        menu_group: 'SISTEMA',
        is_menu_visible: true,
        display_order: 0,
        is_active: true,
      });
    }
  }, [module, reset]);

  const onSubmit = (data: ModuleFormData) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{module ? 'Editar Módulo' : 'Novo Módulo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="crm_leads"
                disabled={!!module}
              />
              {errors.code && (
                <p className="text-sm text-destructive">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" {...register('name')} placeholder="Leads" />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descrição do módulo..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Select
                value={watch('category')}
                onValueChange={(value) => setValue('category', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="menu_group">Grupo do Menu</Label>
              <Select
                value={watch('menu_group') || ''}
                onValueChange={(value) => setValue('menu_group', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {menuGroups.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="route">Rota</Label>
              <Input id="route" {...register('route')} placeholder="/crm/leads" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Ordem</Label>
              <Input
                id="display_order"
                type="number"
                {...register('display_order', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
                <IconComponent className="h-5 w-5" />
              </div>
              <Select
                value={selectedIcon || 'Layers'}
                onValueChange={(value) => setValue('icon', value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um ícone" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {availableIcons.map((icon) => {
                    const Icon = getIcon(icon);
                    return (
                      <SelectItem key={icon} value={icon}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{icon}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="is_menu_visible"
                checked={watch('is_menu_visible')}
                onCheckedChange={(checked) => setValue('is_menu_visible', checked)}
              />
              <Label htmlFor="is_menu_visible">Visível no Menu</Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={watch('is_active')}
                onCheckedChange={(checked) => setValue('is_active', checked)}
              />
              <Label htmlFor="is_active">Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
