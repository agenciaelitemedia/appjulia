import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, Sparkles, Info } from 'lucide-react';
import { CadenceStep, INTERVAL_UNITS, STEP_LIMITS, parseInterval, formatInterval } from '../../types';

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
  const { value: intervalValue, unit: intervalUnit } = parseInterval(step.interval);

  // Handle interval value change with validation
  const handleIntervalValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = parseInt(e.target.value, 10) || 1;
    
    // Validate minimum for minutes
    if (intervalUnit === 'minutes' && value < STEP_LIMITS.MIN_INTERVAL_MINUTES) {
      value = STEP_LIMITS.MIN_INTERVAL_MINUTES;
    } else if (value < 1) {
      value = 1;
    }
    
    onChange({ ...step, interval: formatInterval(value, intervalUnit) });
  };

  // Handle unit change
  const handleIntervalUnitChange = (unit: string) => {
    let value = intervalValue;
    
    // If changing to minutes and current value < 5, adjust
    if (unit === 'minutes' && value < STEP_LIMITS.MIN_INTERVAL_MINUTES) {
      value = STEP_LIMITS.MIN_INTERVAL_MINUTES;
    }
    
    onChange({ ...step, interval: formatInterval(value, unit) });
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...step, title: e.target.value });
  };

  // Handle message change
  const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= STEP_LIMITS.MAX_MESSAGE_CHARS) {
      onChange({ ...step, message: value || null });
    }
  };

  // Message validation (count words)
  const messageWordCount = step.message?.trim().split(/\s+/).filter(Boolean).length || 0;
  const isMessageValid = autoMessage || messageWordCount >= STEP_LIMITS.MIN_MESSAGE_WORDS;
  const messageLength = step.message?.length || 0;

  return (
    <Card className="relative">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Header with step number and remove button */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Etapa {stepNumber}
            </span>
            {canRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive h-8 w-8"
                onClick={onRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Title input */}
          <div className="space-y-2">
            <Label htmlFor={`title-${step.key}`}>Título da etapa</Label>
            <Input
              id={`title-${step.key}`}
              value={step.title}
              onChange={handleTitleChange}
              placeholder="Ex: Primeiro contato"
              className="max-w-md"
            />
          </div>

          {/* Interval: Value + Unit */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Intervalo
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  Tempo de espera antes de enviar esta mensagem
                </TooltipContent>
              </Tooltip>
            </Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={intervalUnit === 'minutes' ? STEP_LIMITS.MIN_INTERVAL_MINUTES : 1}
                value={intervalValue}
                onChange={handleIntervalValueChange}
                onBlur={() => {
                  // Ensure minimum on blur
                  if (intervalUnit === 'minutes' && intervalValue < STEP_LIMITS.MIN_INTERVAL_MINUTES) {
                    onChange({ ...step, interval: formatInterval(STEP_LIMITS.MIN_INTERVAL_MINUTES, intervalUnit) });
                  }
                }}
                className="w-24"
              />
              <Select value={intervalUnit} onValueChange={handleIntervalUnitChange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {intervalUnit === 'minutes' && (
              <p className="text-xs text-muted-foreground">
                Mínimo: {STEP_LIMITS.MIN_INTERVAL_MINUTES} minutos
              </p>
            )}
          </div>

          {/* Message Field */}
          <div className="space-y-2">
            <Label>
              Mensagem {!autoMessage && <span className="text-destructive">*</span>}
            </Label>
            
            {autoMessage ? (
              // Read-only AI message indicator
              <div className="flex items-center gap-2 text-sm bg-muted/50 rounded-md p-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Mensagem gerada automaticamente pela IA Julia</span>
              </div>
            ) : (
              // Editable message field
              <>
                <Textarea
                  value={step.message || ''}
                  onChange={handleMessageChange}
                  placeholder="Digite a mensagem de follow-up..."
                  maxLength={STEP_LIMITS.MAX_MESSAGE_CHARS}
                  rows={3}
                  className={!isMessageValid ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {!isMessageValid && (
                      <span className="text-destructive">
                        Mínimo de {STEP_LIMITS.MIN_MESSAGE_WORDS} palavras obrigatório
                      </span>
                    )}
                  </span>
                  <span className={messageLength > STEP_LIMITS.MAX_MESSAGE_CHARS * 0.9 ? 'text-warning' : ''}>
                    {messageLength}/{STEP_LIMITS.MAX_MESSAGE_CHARS}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
