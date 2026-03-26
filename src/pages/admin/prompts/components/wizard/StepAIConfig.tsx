import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

interface AIConfigData {
  aiName: string;
  practiceAreas: string;
  workingHours: string;
  officeInfo: string;
  welcomeMessage: string;
}

interface StepAIConfigProps {
  data: AIConfigData;
  onChange: (data: AIConfigData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepAIConfig({ data, onChange, onNext, onBack }: StepAIConfigProps) {
  const update = (field: keyof AIConfigData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-1">Configurações da IA</h3>
        <p className="text-sm text-muted-foreground">Defina as informações de identidade e funcionamento</p>
      </div>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
        <div>
          <Label>Nome da IA</Label>
          <Input value={data.aiName} onChange={e => update('aiName', e.target.value)} />
        </div>
        <div>
          <Label>Áreas de Atuação</Label>
          <Textarea value={data.practiceAreas} onChange={e => update('practiceAreas', e.target.value)} rows={8} className="font-mono text-sm" />
        </div>
        <div>
          <Label>Horário de Funcionamento</Label>
          <Textarea value={data.workingHours} onChange={e => update('workingHours', e.target.value)} rows={4} className="font-mono text-sm" />
        </div>
        <div>
          <Label>Informações do Escritório</Label>
          <Textarea value={data.officeInfo} onChange={e => update('officeInfo', e.target.value)} rows={5} className="font-mono text-sm" />
        </div>
        <div>
          <Label>Mensagem de Boas Vindas</Label>
          <Textarea value={data.welcomeMessage} onChange={e => update('welcomeMessage', e.target.value)} rows={10} className="font-mono text-sm" />
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={onNext} disabled={!data.aiName.trim()}>Próximo</Button>
      </div>
    </div>
  );
}
