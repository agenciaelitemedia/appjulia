import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, Sparkles, AlertTriangle, Flame, Clock, TrendingUp, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { CopilotSettings } from '../hooks/useCopilotAdmin';

const INSIGHT_TYPES = [
  { key: 'stuck_lead', label: 'Lead Parado', icon: Clock, desc: 'Detectar leads sem movimentação há mais de 48h' },
  { key: 'hot_opportunity', label: 'Oportunidade Quente', icon: Flame, desc: 'Leads que avançaram de etapa recentemente' },
  { key: 'risk', label: 'Risco de Perda', icon: AlertTriangle, desc: 'Leads em risco de serem perdidos' },
  { key: 'follow_up_needed', label: 'Follow-up Necessário', icon: TrendingUp, desc: 'Leads que precisam de ação imediata' },
  { key: 'summary', label: 'Resumo Geral', icon: Info, desc: 'Resumo consolidado do estado do CRM' },
];

interface Props {
  settings: CopilotSettings | null;
  isLoading: boolean;
  onSave: (settings: Partial<CopilotSettings>) => void;
  isSaving: boolean;
}

export function CopilotSettingsTab({ settings, isLoading, onSave, isSaving }: Props) {
  const [enabledTypes, setEnabledTypes] = useState<string[]>(
    INSIGHT_TYPES.map((t) => t.key)
  );
  const [maxInsights, setMaxInsights] = useState(5);
  const [customPrompt, setCustomPrompt] = useState('');

  useEffect(() => {
    if (settings) {
      setEnabledTypes(settings.enabled_insight_types || INSIGHT_TYPES.map((t) => t.key));
      setMaxInsights(settings.max_insights_per_run || 5);
      setCustomPrompt(settings.custom_prompt_suffix || '');
    }
  }, [settings]);

  const toggleType = (key: string) => {
    setEnabledTypes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  };

  const handleSave = () => {
    onSave({
      enabled_insight_types: enabledTypes as any,
      max_insights_per_run: maxInsights,
      custom_prompt_suffix: customPrompt || null,
    });
    toast.success('Configurações salvas');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Types */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Tipos de Alertas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {INSIGHT_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div key={type.key} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label className="text-sm">{type.label}</Label>
                    <p className="text-xs text-muted-foreground">{type.desc}</p>
                  </div>
                </div>
                <Switch
                  checked={enabledTypes.includes(type.key)}
                  onCheckedChange={() => toggleType(type.key)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Limits */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Limites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Máximo de insights por execução</Label>
            <p className="text-sm text-muted-foreground">Quantos insights a IA pode gerar por agente em cada análise</p>
            <Input
              type="number"
              min={1}
              max={20}
              value={maxInsights}
              onChange={(e) => setMaxInsights(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Prompt */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prompt Personalizado (Avançado)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <FormDescription>
            Texto adicional adicionado ao prompt da IA. Use para personalizar o comportamento da análise.
          </FormDescription>
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Ex: Priorize alertas sobre leads da campanha de aposentadoria..."
            className="min-h-[100px] resize-y"
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving}>
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
        Salvar Configurações
      </Button>
    </div>
  );
}
