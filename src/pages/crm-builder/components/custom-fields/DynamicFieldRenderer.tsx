import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CRMCustomField, FieldType, FieldOption } from '../../hooks/useCRMCustomFields';

interface DynamicFieldRendererProps {
  field: CRMCustomField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
}

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  disabled = false,
}: DynamicFieldRendererProps) {
  const renderField = () => {
    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Digite ${field.field_label.toLowerCase()}`}
            disabled={disabled}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="0"
            disabled={disabled}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="email@exemplo.com"
            disabled={disabled}
          />
        );

      case 'phone':
        return (
          <Input
            type="tel"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="(11) 99999-9999"
            disabled={disabled}
          />
        );

      case 'url':
        return (
          <Input
            type="url"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
            disabled={disabled}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={`field-${field.id}`}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => onChange(checked)}
              disabled={disabled}
            />
            <Label 
              htmlFor={`field-${field.id}`} 
              className="text-sm font-normal cursor-pointer"
            >
              {field.field_label}
            </Label>
          </div>
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => onChange(v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {field.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'multiselect':
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2">
            <Select
              value=""
              onValueChange={(v) => {
                if (!selectedValues.includes(v)) {
                  onChange([...selectedValues, v]);
                }
              }}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Adicionar..." />
              </SelectTrigger>
              <SelectContent>
                {field.options
                  .filter(opt => !selectedValues.includes(opt.value))
                  .map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedValues.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedValues.map((val) => {
                  const option = field.options.find(o => o.value === val);
                  return (
                    <Badge
                      key={val}
                      variant="secondary"
                      className="gap-1"
                    >
                      {option?.label || val}
                      {!disabled && (
                        <button
                          type="button"
                          onClick={() => onChange(selectedValues.filter(v => v !== val))}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Checkbox renders its own label
  if (field.field_type === 'checkbox') {
    return renderField();
  }

  return (
    <div className="space-y-2">
      <Label>
        {field.field_label}
        {field.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {renderField()}
    </div>
  );
}

// Field type configuration
export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; description: string }> = {
  text: { label: 'Texto', description: 'Campo de texto simples' },
  number: { label: 'Número', description: 'Valores numéricos' },
  date: { label: 'Data', description: 'Seletor de data' },
  select: { label: 'Seleção única', description: 'Escolha uma opção de uma lista' },
  multiselect: { label: 'Seleção múltipla', description: 'Escolha várias opções' },
  checkbox: { label: 'Checkbox', description: 'Marcação verdadeiro/falso' },
  url: { label: 'URL', description: 'Link para website' },
  email: { label: 'E-mail', description: 'Endereço de e-mail' },
  phone: { label: 'Telefone', description: 'Número de telefone' },
};
