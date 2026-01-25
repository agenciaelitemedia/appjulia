import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileWarning } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface CreativeUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CreativeCategory[];
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function CreativeUploadDialog({ open, onOpenChange, categories }: CreativeUploadDialogProps) {
  const { user } = useAuth();
  const createMutation = useCreateCreative();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<UploadFormData>({
    title: '',
    description: '',
    categoryId: null,
    shared: false,
    file: null,
  });
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Tipo de arquivo não permitido. Use imagens (JPG, PNG, GIF, WebP) ou vídeos (MP4, WebM, MOV).';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'Arquivo muito grande. Tamanho máximo: 50MB.';
    }
    return null;
  };

  const handleFile = useCallback((file: File) => {
    setFileError(null);
    const error = validateFile(file);
    if (error) {
      setFileError(error);
      return;
    }

    setFormData(prev => ({ 
      ...prev, 
      file, 
      title: prev.title || file.name.split('.')[0] 
    }));
    
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  const uploadToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('creatives')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from('creatives')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const handleSubmit = async () => {
    if (!formData.file || !user) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Upload file to storage
      setUploadProgress(30);
      const fileUrl = await uploadToStorage(formData.file);
      setUploadProgress(70);

      // Determine file type
      const typeFile = formData.file.type.startsWith('video/') ? 'video' : 'image';

      // Save metadata to database
      await createMutation.mutateAsync({
        user_id: user.id,
        type_file: typeFile,
        name: fileUrl, // Store the URL in the name field
        title: formData.title,
        description: formData.description,
        creative_category_id: formData.categoryId,
        shared: formData.shared,
      });

      setUploadProgress(100);
      
      toast({
        title: 'Sucesso!',
        description: 'Criativo enviado com sucesso.',
      });

      handleClose();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Erro no upload',
        description: error.message || 'Não foi possível enviar o arquivo.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setFormData({ title: '', description: '', categoryId: null, shared: false, file: null });
    setPreview(null);
    setFileError(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const removeFile = () => {
    setPreview(null);
    setFormData(prev => ({ ...prev, file: null }));
    setFileError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : fileError 
                  ? 'border-destructive bg-destructive/5'
                  : 'border-border hover:border-primary/50'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
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
                  onClick={removeFile}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept={ALLOWED_TYPES.join(',')}
                  className="hidden"
                  onChange={handleFileChange}
                />
                {fileError ? (
                  <>
                    <FileWarning className="h-10 w-10 mx-auto text-destructive mb-2" />
                    <p className="text-sm font-medium text-destructive">{fileError}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clique para tentar novamente</p>
                  </>
                ) : (
                  <>
                    <Upload className={`h-10 w-10 mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-sm font-medium">
                      {isDragging ? 'Solte o arquivo aqui' : 'Clique ou arraste um arquivo'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Imagens (JPG, PNG, GIF, WebP) ou Vídeos (MP4, WebM, MOV) até 50MB
                    </p>
                  </>
                )}
              </label>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                Enviando... {uploadProgress}%
              </p>
            </div>
          )}

          {/* Título */}
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input 
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Nome do criativo"
              disabled={isUploading}
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
              disabled={isUploading}
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
              disabled={isUploading}
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
              disabled={isUploading}
            />
            <Label htmlFor="shared" className="cursor-pointer">
              Compartilhar na Biblioteca (outros usuários poderão ver)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!formData.file || !formData.title || isUploading || createMutation.isPending}
          >
            {isUploading ? 'Enviando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
