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
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, X, Info } from 'lucide-react';
import { 
  PROCESS_PHASES, 
  EVENT_TYPES, 
  TEMPLATE_VARIABLES,
  type AdvboxNotificationRule,
  type AdvboxNotificationRuleFormData,
  type SendTo,
} from '@/types/advbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface RuleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AdvboxNotificationRule | null;
  onSave: (data: AdvboxNotificationRuleFormData) => Promise<boolean>;
  isSaving: boolean;
}

export function RuleEditorDialog({
  open,
  onOpenChange,
  rule,
  onSave,
  isSaving,
}: RuleEditorDialogProps) {
  const [formData, setFormData] = useState<AdvboxNotificationRuleFormData>({
    rule_name: '',
    is_active: true,
    process_phases: [],
    event_types: [],
    keywords: [],
    message_template: '',
    send_to: 'cliente',
    cooldown_minutes: 60,
  });

  const [newKeyword, setNewKeyword] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setFormData({
        rule_name: rule.rule_name,
        is_active: rule.is_active,
        process_phases: rule.process_phases || [],
        event_types: rule.event_types || [],
        keywords: rule.keywords || [],
        message_template: rule.message_template,
        send_to: rule.send_to,
        cooldown_minutes: rule.cooldown_minutes,
      });
    } else {
      setFormData({
        rule_name: '',
        is_active: true,
        process_phases: [],
        event_types: [],
        keywords: [],
        message_template: getDefaultTemplate(),
        send_to: 'cliente',
        cooldown_minutes: 60,
      });
    }
  }, [rule, open]);

  const getDefaultTemplate = () => {
    return `Olá {client_name}! 👋

Temos uma atualização sobre o seu processo {process_number}:

📋 *{movement_text}*

📅 Data: {movement_date}
📌 Fase atual: {phase}

Se tiver dúvidas, estou à disposição!

Atenciosamente,
{law_firm_name}`;
  };

  const togglePhase = (phase: string) => {
    setFormData(prev => ({
      ...prev,
      process_phases: prev.process_phases.includes(phase)
        ? prev.process_phases.filter(p => p !== phase)
        : [...prev.process_phases, phase],
    }));
  };

  const toggleEventType = (event: string) => {
    setFormData(prev => ({
      ...prev,
      event_types: prev.event_types.includes(event)
        ? prev.event_types.filter(e => e !== event)
        : [...prev.event_types, event],
    }));
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData(prev => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()],
      }));
      setNewKeyword('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== keyword),
    }));
  };

  const insertVariable = (placeholder: string) => {
    setFormData(prev => ({
      ...prev,
      message_template: prev.message_template + placeholder,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar Regra' : 'Nova Regra de Notificação'}</DialogTitle>
          <DialogDescription>
            Configure os filtros e o template da mensagem de notificação
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule_name">Nome da Regra</Label>
                <Input
                  id="rule_name"
                  placeholder="Ex: Notificar sentenças"
                  value={formData.rule_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, rule_name: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="send_to">Enviar Para</Label>
                <Select
                  value={formData.send_to}
                  onValueChange={(value: SendTo) => setFormData(prev => ({ ...prev, send_to: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cliente">Cliente</SelectItem>
                    <SelectItem value="advogado">Advogado</SelectItem>
                    <SelectItem value="ambos">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Regra Ativa</Label>
                <p className="text-sm text-muted-foreground">
                  Desative para pausar o envio de notificações
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
            </div>
          </div>

          <Separator />

          {/* Filters */}
          <div className="space-y-4">
            <h4 className="font-medium">Filtros</h4>
            
            {/* Process Phases */}
            <div className="space-y-2">
              <Label>Fases do Processo</Label>
              <div className="flex flex-wrap gap-2">
                {PROCESS_PHASES.map((phase) => (
                  <Badge
                    key={phase}
                    variant={formData.process_phases.includes(phase) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => togglePhase(phase)}
                  >
                    {phase}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para todas as fases
              </p>
            </div>

            {/* Event Types */}
            <div className="space-y-2">
              <Label>Tipos de Evento</Label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((event) => (
                  <Badge
                    key={event}
                    variant={formData.event_types.includes(event) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleEventType(event)}
                  >
                    {event}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para todos os tipos
              </p>
            </div>

            {/* Keywords */}
            <div className="space-y-2">
              <Label>Palavras-chave (opcional)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite uma palavra-chave"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                />
                <Button type="button" variant="outline" onClick={addKeyword}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {formData.keywords.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.keywords.map((keyword) => (
                    <Badge key={keyword} variant="secondary" className="gap-1">
                      {keyword}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeKeyword(keyword)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Cooldown */}
            <div className="space-y-2">
              <Label htmlFor="cooldown">Cooldown (minutos)</Label>
              <Input
                id="cooldown"
                type="number"
                min={1}
                max={1440}
                value={formData.cooldown_minutes}
                onChange={(e) => setFormData(prev => ({ ...prev, cooldown_minutes: parseInt(e.target.value) || 60 }))}
              />
              <p className="text-xs text-muted-foreground">
                Tempo mínimo entre notificações para o mesmo processo
              </p>
            </div>
          </div>

          <Separator />

          {/* Message Template */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Template da Mensagem</h4>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" type="button">
                      <Info className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-sm">
                    <p>Use as variáveis abaixo para personalizar a mensagem. Elas serão substituídas pelos dados reais do processo.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Variables */}
            <div className="space-y-2">
              <Label>Variáveis Disponíveis</Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARIABLES.map((variable) => (
                  <TooltipProvider key={variable.key}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => insertVariable(variable.placeholder)}
                        >
                          {variable.placeholder}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{variable.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            </div>

            {/* Template Editor */}
            <div className="space-y-2">
              <Label htmlFor="template">Mensagem</Label>
              <Textarea
                id="template"
                placeholder="Digite o template da mensagem..."
                value={formData.message_template}
                onChange={(e) => setFormData(prev => ({ ...prev, message_template: e.target.value }))}
                rows={10}
                className="font-mono text-sm"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {rule ? 'Salvar Alterações' : 'Criar Regra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
