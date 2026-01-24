import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, GripVertical, Sparkles, Edit2, Check, X } from 'lucide-react';
import { CadenceStep, INTERVAL_OPTIONS } from '../../types';
import { useState } from 'react';

interface CadenceStepEditorProps {
  step: CadenceStep;
  stepNumber: number;
  autoMessage: boolean;
  onChange: (step: CadenceStep) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export function CadenceStepEditor({
  step,
  stepNumber,
  autoMessage,
  onChange,
  onRemove,
  canRemove,
}: CadenceStepEditorProps) {
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [tempMessage, setTempMessage] = useState(step.message || '');

  const handleIntervalChange = (value: string) => {
    onChange({ ...step, interval: value });
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...step, title: e.target.value });
  };

  const handleSaveMessage = () => {
    onChange({ ...step, message: tempMessage || null });
    setIsEditingMessage(false);
  };

  const handleCancelMessage = () => {
    setTempMessage(step.message || '');
    setIsEditingMessage(false);
  };

  const handleClearMessage = () => {
    onChange({ ...step, message: null });
    setTempMessage('');
    setIsEditingMessage(false);
  };

  return (
    <Card className="relative">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center text-muted-foreground mt-2">
            <GripVertical className="h-5 w-5" />
          </div>

          <div className="flex-1 space-y-4">
            {/* Header with step number and interval */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  Etapa {stepNumber}
                </span>
              </div>

              <div className="flex-1 min-w-[200px]">
                <Select value={step.interval} onValueChange={handleIntervalChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o intervalo" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVAL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={onRemove}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Title input */}
            <div className="space-y-1">
              <Label htmlFor={`title-${step.key}`} className="text-sm">
                Título da etapa
              </Label>
              <Input
                id={`title-${step.key}`}
                value={step.title}
                onChange={handleTitleChange}
                placeholder="Ex: Primeiro contato"
                className="max-w-md"
              />
            </div>

            {/* Message section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Mensagem</Label>
                {!isEditingMessage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingMessage(true)}
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    {step.message ? 'Editar' : 'Personalizar'}
                  </Button>
                )}
              </div>

              {isEditingMessage ? (
                <div className="space-y-2">
                  <Textarea
                    value={tempMessage}
                    onChange={(e) => setTempMessage(e.target.value)}
                    placeholder="Digite uma mensagem personalizada ou deixe em branco para usar IA"
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleSaveMessage}>
                      <Check className="h-3 w-3 mr-1" />
                      Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelMessage}>
                      <X className="h-3 w-3 mr-1" />
                      Cancelar
                    </Button>
                    {step.message && (
                      <Button size="sm" variant="ghost" onClick={handleClearMessage}>
                        Usar automática
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md p-3">
                  {step.message ? (
                    <p className="line-clamp-2">{step.message}</p>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>
                        {autoMessage
                          ? 'Mensagem gerada automaticamente pela IA Julia'
                          : 'Nenhuma mensagem definida (automático desativado)'}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
