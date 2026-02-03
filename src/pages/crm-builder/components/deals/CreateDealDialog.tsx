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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import type { CRMDealFormData, CRMDeal, DealPriority } from '../../types';
import { PRIORITY_CONFIG } from '../../types';
import type { CRMCustomField } from '../../hooks/useCRMCustomFields';
import { DynamicFieldRenderer } from '../custom-fields/DynamicFieldRenderer';

interface CreateDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CRMDealFormData) => Promise<CRMDeal | null>;
  pipelineName?: string;
  editDeal?: CRMDeal | null;
  customFields?: CRMCustomField[];
}

export function CreateDealDialog({
  open,
  onOpenChange,
  onSubmit,
  pipelineName,
  editDeal,
  customFields = [],
}: CreateDealDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(editDeal?.title || '');
  const [description, setDescription] = useState(editDeal?.description || '');
  const [value, setValue] = useState(editDeal?.value?.toString() || '');
  const [contactName, setContactName] = useState(editDeal?.contact_name || '');
  const [contactPhone, setContactPhone] = useState(editDeal?.contact_phone || '');
  const [contactEmail, setContactEmail] = useState(editDeal?.contact_email || '');
  const [priority, setPriority] = useState<DealPriority>(editDeal?.priority || 'medium');
  const [tagsInput, setTagsInput] = useState(editDeal?.tags?.join(', ') || '');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>(
    (editDeal?.custom_fields as Record<string, unknown>) || {}
  );

  // Reset form when editDeal changes
  useEffect(() => {
    if (editDeal) {
      setTitle(editDeal.title);
      setDescription(editDeal.description || '');
      setValue(editDeal.value?.toString() || '');
      setContactName(editDeal.contact_name || '');
      setContactPhone(editDeal.contact_phone || '');
      setContactEmail(editDeal.contact_email || '');
      setPriority(editDeal.priority);
      setTagsInput(editDeal.tags?.join(', ') || '');
      setCustomFieldValues((editDeal.custom_fields as Record<string, unknown>) || {});
    } else {
      setTitle('');
      setDescription('');
      setValue('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
      setPriority('medium');
      setTagsInput('');
      setCustomFieldValues({});
    }
  }, [editDeal]);

  const handleCustomFieldChange = (fieldName: string, value: unknown) => {
    setCustomFieldValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Merge custom fields into deal form data
      const formData: CRMDealFormData = {
        title: title.trim(),
        description: description.trim() || undefined,
        value: parseFloat(value) || 0,
        contact_name: contactName.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        contact_email: contactEmail.trim() || undefined,
        priority,
        tags,
      };

      // Add custom fields to the formData object for passing to parent
      const formDataWithCustom = {
        ...formData,
        custom_fields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      };

      const result = await onSubmit(formDataWithCustom as CRMDealFormData);

      if (result) {
        onOpenChange(false);
        // Reset form
        setTitle('');
        setDescription('');
        setValue('');
        setContactName('');
        setContactPhone('');
        setContactEmail('');
        setPriority('medium');
        setTagsInput('');
        setCustomFieldValues({});
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editDeal ? 'Editar Card' : 'Novo Card'}
            </DialogTitle>
            <DialogDescription>
              {editDeal 
                ? 'Atualize as informações do card.'
                : pipelineName 
                  ? `Adicionar novo card em "${pipelineName}"`
                  : 'Adicione um novo card ao pipeline.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Contrato Silva & Associados"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes sobre o negócio..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="value">Valor (R$)</Label>
                <Input
                  id="value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="0,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as DealPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Contato</h4>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Nome</Label>
                  <Input
                    id="contactName"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Nome do contato"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Telefone</Label>
                    <Input
                      id="contactPhone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contactEmail">E-mail</Label>
                    <Input
                      id="contactEmail"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Custom Fields */}
            {customFields.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium mb-3">Campos Adicionais</h4>
                  <div className="space-y-4">
                    {customFields.filter(f => f.is_visible).map((field) => (
                      <DynamicFieldRenderer
                        key={field.id}
                        field={field}
                        value={customFieldValues[field.field_name]}
                        onChange={(value) => handleCustomFieldChange(field.field_name, value)}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ex: urgente, vip, retorno"
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
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Salvando...' : editDeal ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
