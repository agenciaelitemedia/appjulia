import { useState } from 'react';
import { Upload, X } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { CreativeCategory, UploadFormData } from '../types';
import { useCreateCreative } from '../hooks/useCriativosData';

interface CreativeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CreativeCategory[];
}

export function CreativeUploadDialog({ open, onOpenChange, categories }: CreativeUploadDialogProps) {
  const { user } = useAuth();
  const createMutation = useCreateCreative();
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    description: '',
    categoryId: null,
    shared: false,
    file: null,
  });
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, file, title: file.name.split('.')[0] });
      
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!formData.file || !user) return;

    const typeFile = formData.file.type.startsWith('video/') ? 'video' : 'image';

    await createMutation.mutateAsync({
      user_id: user.id,
      type_file: typeFile,
      name: formData.file.name,
      title: formData.title,
      description: formData.description,
      creative_category_id: formData.categoryId,
      shared: formData.shared,
    });

    onOpenChange(false);
    setFormData({ title: '', description: '', categoryId: null, shared: false, file: null });
    setPreview(null);
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ title: '', description: '', categoryId: null, shared: false, file: null });
    setPreview(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Criativo</DialogTitle>
          <DialogDescription>
            Adicione uma imagem ou vídeo à sua biblioteca
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Drop Zone */}
          <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
            {preview ? (
              <div className="relative">
                {formData.file?.type.startsWith('video/') ? (
                  <video src={preview} className="max-h-48 mx-auto rounded" controls />
                ) : (
                  <img src={preview} className="max-h-48 mx-auto rounded" alt="Preview" />
                )}
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="absolute top-2 right-2"
                  onClick={() => { setPreview(null); setFormData({ ...formData, file: null }); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Clique para selecionar</p>
                <p className="text-xs text-muted-foreground">ou arraste e solte aqui</p>
              </label>
            )}
          </div>

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
              id="shared"
              checked={formData.shared}
              onCheckedChange={(checked) => setFormData({ 
                ...formData, 
                shared: !!checked 
              })}
            />
            <Label htmlFor="shared" className="cursor-pointer">
              Compartilhar na Biblioteca (outros usuários poderão ver)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.file || !formData.title || createMutation.isPending}
          >
            {createMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
