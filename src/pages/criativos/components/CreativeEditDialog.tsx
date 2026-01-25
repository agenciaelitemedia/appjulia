import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreativeFile } from '../types';
import { useUpdateCreative, useCreativeCategories } from '../hooks/useCriativosData';

interface CreativeEditDialogProps {
  file: CreativeFile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreativeEditDialog({ file, open, onOpenChange }: CreativeEditDialogProps) {
  const updateMutation = useUpdateCreative();
  const { data: categories = [] } = useCreativeCategories();
  
  const [formData, setFormData] = useState({
    title: file.title,
    description: file.description || '',
    categoryId: file.creative_category_id,
    shared: file.shared,
  });

  useEffect(() => {
    if (open) {
      setFormData({
        title: file.title,
        description: file.description || '',
        categoryId: file.creative_category_id,
        shared: file.shared,
      });
    }
  }, [open, file]);

  const handleSubmit = async () => {
    await updateMutation.mutateAsync({
      id: file.id,
      title: formData.title,
      description: formData.description,
      creative_category_id: formData.categoryId,
      shared: formData.shared,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Criativo</DialogTitle>
          <DialogDescription>
            Atualize as informações do criativo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Título */}
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input 
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nome do criativo"
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea 
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional..."
              rows={3}
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select 
              value={formData.categoryId?.toString() || ''}
              onValueChange={(v) => setFormData({ 
                ...formData, 
                categoryId: v ? Number(v) : null 
              })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Compartilhar */}
          <div className="flex items-center gap-2">
            <Checkbox 
              id="edit-shared"
              checked={formData.shared}
              onCheckedChange={(checked) => setFormData({ 
                ...formData, 
                shared: !!checked 
              })}
            />
            <Label htmlFor="edit-shared" className="cursor-pointer">
              Compartilhar na Biblioteca (outros usuários poderão ver)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.title || updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
