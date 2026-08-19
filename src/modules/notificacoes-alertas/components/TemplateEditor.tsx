import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ALERT_VARIABLES } from '../module';

interface TemplateEditorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export function TemplateEditor({ value, onChange, disabled }: TemplateEditorProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm">Mensagem enviada</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={9}
        disabled={disabled}
        className="font-mono text-sm"
      />
      <div className="flex flex-wrap gap-1">
        {ALERT_VARIABLES.map((v) => (
          <Button
            key={v.key}
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            className="h-7 text-xs"
            onClick={() => onChange(`${value}{${v.key}}`)}
            title={v.label}
          >
            {`{${v.key}}`}
          </Button>
        ))}
      </div>
    </div>
  );
}
