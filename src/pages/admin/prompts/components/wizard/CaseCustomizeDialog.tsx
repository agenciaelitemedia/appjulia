import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { TagInput } from './TagInput';
import {
  DEFAULT_ZAPSIGN_TOKEN,
  DEFAULT_FEES_TEXT,
  DEFAULT_CONTRACT_FIELDS,
  ContractField,
  processNegotiationText,
} from '../../constants/promptDefaults';

export interface CaseData {
  case_id: string;
  case_name: string;
  ctas: string[];
  semantic_words: string;
  case_info: string;
  qualification_script: string;
  zapsign_token: string;
  zapsign_doc_token: string;
  contract_fields: ContractField[];
  fees_text: string;
  closing_model_text: string;
  negotiation_text: string;
  position: number;
}

interface CaseCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseData: CaseData | null;
  onSave: (data: CaseData) => void;
  templateClosingModel: string;
}

export function CaseCustomizeDialog({ open, onOpenChange, caseData, onSave, templateClosingModel }: CaseCustomizeDialogProps) {
  const [data, setData] = useState<CaseData | null>(null);

  useEffect(() => {
    if (caseData) {
      setData({
        ...caseData,
        zapsign_token: caseData.zapsign_token || DEFAULT_ZAPSIGN_TOKEN,
        contract_fields: caseData.contract_fields?.length ? caseData.contract_fields : DEFAULT_CONTRACT_FIELDS,
        fees_text: caseData.fees_text || DEFAULT_FEES_TEXT,
        closing_model_text: caseData.closing_model_text || templateClosingModel,
      });
    }
  }, [caseData, templateClosingModel]);

  if (!data) return null;

  const update = <K extends keyof CaseData>(field: K, value: CaseData[K]) => {
    setData(prev => prev ? { ...prev, [field]: value } : prev);
  };

  const toggleContractField = (index: number) => {
    const updated = [...data.contract_fields];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    update('contract_fields', updated);
  };

  const handleSave = () => {
    const negotiation = processNegotiationText(
      data.closing_model_text,
      data.zapsign_token,
      data.zapsign_doc_token,
      data.contract_fields,
      data.fees_text
    );
    onSave({ ...data, negotiation_text: negotiation });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Personalizar Caso: {data.case_name}</DialogTitle>
          <DialogDescription>Configure os detalhes específicos deste caso para o agente</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>CTAs do Caso</Label>
            <TagInput value={data.ctas} onChange={v => update('ctas', v)} placeholder="Digite um CTA e pressione Enter..." />
          </div>

          <div>
            <Label>Palavras Semânticas</Label>
            <Textarea value={data.semantic_words} onChange={e => update('semantic_words', e.target.value)} rows={3} className="font-mono text-sm" placeholder='"gravidez", "grávida", "bebê" → Salário-maternidade' />
          </div>

          <div>
            <Label>Informações do Caso</Label>
            <Textarea value={data.case_info} onChange={e => update('case_info', e.target.value)} rows={8} className="font-mono text-sm" />
          </div>

          <div>
            <Label>Roteiro de Qualificação</Label>
            <Textarea value={data.qualification_script} onChange={e => update('qualification_script', e.target.value)} rows={8} className="font-mono text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ZapSign Token</Label>
              <Input value={data.zapsign_token} onChange={e => update('zapsign_token', e.target.value)} className="font-mono text-xs" />
            </div>
            <div>
              <Label>ZapSign Documento Token</Label>
              <Input value={data.zapsign_doc_token} onChange={e => update('zapsign_doc_token', e.target.value)} className="font-mono text-xs" />
            </div>
          </div>

          <div>
            <Label>Informações para Contrato</Label>
            <div className="grid grid-cols-2 gap-2 mt-2 border rounded-md p-3">
              {data.contract_fields.map((field, i) => (
                <div key={field.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`cf-${field.value}`}
                    checked={field.checked}
                    onCheckedChange={() => toggleContractField(i)}
                  />
                  <Label htmlFor={`cf-${field.value}`} className="text-xs font-normal cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Honorários do Caso</Label>
            <Textarea value={data.fees_text} onChange={e => update('fees_text', e.target.value)} rows={6} className="font-mono text-sm" />
          </div>

          <div>
            <Label>Modelo de Fechamento</Label>
            <Textarea value={data.closing_model_text} onChange={e => update('closing_model_text', e.target.value)} rows={8} className="font-mono text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Personalização</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
