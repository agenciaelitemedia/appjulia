import { useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import type { CRMCustomField, CRMCustomFieldFormData, FieldType, FieldOption } from '../../hooks/useCRMCustomFields';
import { FIELD_TYPE_CONFIG } from './DynamicFieldRenderer';

interface CreateCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CRMCustomFieldFormData) => Promise<CRMCustomField | null>;
  editField?: CRMCustomField | null;
}

const toSnakeCase = (str: string) => {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
};

export function CreateCustomFieldDialog({
  open,
  onOpenChange,
  onSubmit,
  editField,
}: CreateCustomFieldDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldLabel, setFieldLabel] = useState(editField?.field_label || '');
  const [fieldName, setFieldName] = useState(editField?.field_name || '');
  const [fieldType, setFieldType] = useState<FieldType>(editField?.field_type || 'text');
  const [isRequired, setIsRequired] = useState(editField?.is_required || false);
  const [options, setOptions] = useState<FieldOption[]>(editField?.options || []);
  const [newOptionLabel, setNewOptionLabel] = useState('');

  const needsOptions = fieldType === 'select' || fieldType === 'multiselect';

  const handleLabelChange = (label: string) => {
    setFieldLabel(label);
    if (!editField) {
      setFieldName(toSnakeCase(label));
    }
  };

  const handleAddOption = () => {
    if (!newOptionLabel.trim()) return;
    const newOption: FieldOption = {
      value: toSnakeCase(newOptionLabel),
      label: newOptionLabel.trim(),
    };
    setOptions([...options, newOption]);
    setNewOptionLabel('');
  };

  const handleRemoveOption = (value: string) => {
    setOptions(options.filter(o => o.value !== value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldLabel.trim() || !fieldName.trim()) return;
    if (needsOptions && options.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await onSubmit({
        field_name: fieldName,
        field_label: fieldLabel.trim(),
        field_type: fieldType,
        options: needsOptions ? options : undefined,
        is_required: isRequired,
      });

      if (result) {
        onOpenChange(false);
        // Reset form
        setFieldLabel('');
        setFieldName('');
        setFieldType('text');
        setIsRequired(false);
        setOptions([]);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editField ? 'Editar Campo' : 'Novo Campo Customizado'}
            </DialogTitle>
            <DialogDescription>
              {editField 
                ? 'Atualize as propriedades do campo.'
                : 'Adicione um campo personalizado ao seu board.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fieldLabel">Nome do Campo *</Label>
              <Input
                id="fieldLabel"
                value={fieldLabel}
                onChange={(e) => handleLabelChange(e.target.value)}
                placeholder="Ex: Data de Vencimento"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fieldName">ID Interno</Label>
              <Input
                id="fieldName"
                value={fieldName}
                onChange={(e) => setFieldName(toSnakeCase(e.target.value))}
                placeholder="data_vencimento"
                disabled={!!editField}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Identificador único usado internamente
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tipo do Campo</Label>
              <Select value={fieldType} onValueChange={(v) => setFieldType(v as FieldType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FIELD_TYPE_CONFIG).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      <div className="flex flex-col items-start">
                        <span>{config.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {config.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Options for select/multiselect */}
            {needsOptions && (
              <div className="space-y-2">
                <Label>Opções *</Label>
                <div className="flex gap-2">
                  <Input
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    placeholder="Nova opção..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption();
                      }
                    }}
                  />
                  <Button 
                    type="button" 
                    size="icon" 
                    variant="outline"
                    onClick={handleAddOption}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {options.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {options.map((opt) => (
                      <Badge key={opt.value} variant="secondary" className="gap-1">
                        {opt.label}
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(opt.value)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Adicione pelo menos uma opção
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Campo Obrigatório</Label>
                <p className="text-xs text-muted-foreground">
                  O usuário deve preencher ao criar um deal
                </p>
              </div>
              <Switch
                checked={isRequired}
                onCheckedChange={setIsRequired}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={
                isSubmitting || 
                !fieldLabel.trim() || 
                !fieldName.trim() ||
                (needsOptions && options.length === 0)
              }
            >
              {isSubmitting ? 'Salvando...' : editField ? 'Salvar' : 'Criar Campo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
