import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { SearchedAgent } from '@/pages/agents/hooks/useAgentSearch';
import { Template } from '../hooks/useTemplates';
import { useAgentPrompts } from '../hooks/useAgentPrompts';
import { StepAgentSearch } from './wizard/StepAgentSearch';
import { StepTemplateSelect } from './wizard/StepTemplateSelect';
import { StepAIConfig } from './wizard/StepAIConfig';
import { StepCaseSelect } from './wizard/StepCaseSelect';
import { CaseData } from './wizard/CaseCustomizeDialog';
import {
  DEFAULT_AI_NAME,
  DEFAULT_PRACTICE_AREAS,
  DEFAULT_WORKING_HOURS,
  DEFAULT_OFFICE_INFO,
  DEFAULT_WELCOME_MESSAGE,
} from '../constants/promptDefaults';

interface AgentPromptWizardProps {
  onClose: () => void;
  onSaved: () => void;
}

const STEPS = ['Agente', 'Template', 'Informações', 'Casos'];

export function AgentPromptWizard({ onClose, onSaved }: AgentPromptWizardProps) {
  const { user } = useAuth();
  const { createPrompt } = useAgentPrompts();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step A
  const [selectedAgent, setSelectedAgent] = useState<SearchedAgent | null>(null);

  // Step B
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Step C
  const [aiConfig, setAiConfig] = useState({
    aiName: DEFAULT_AI_NAME,
    practiceAreas: DEFAULT_PRACTICE_AREAS,
    workingHours: DEFAULT_WORKING_HOURS,
    officeInfo: DEFAULT_OFFICE_INFO,
    welcomeMessage: DEFAULT_WELCOME_MESSAGE,
  });

  // Step D
  const [cases, setCases] = useState<CaseData[]>([]);

  const handleSave = async () => {
    if (!selectedAgent || !selectedTemplate) return;
    setSaving(true);

    const promptData = {
      cod_agent: selectedAgent.cod_agent,
      agent_name: selectedAgent.client_name,
      business_name: selectedAgent.business_name,
      template_id: selectedTemplate.id,
      ai_name: aiConfig.aiName,
      practice_areas: aiConfig.practiceAreas,
      working_hours: aiConfig.workingHours,
      office_info: aiConfig.officeInfo,
      welcome_message: aiConfig.welcomeMessage,
      created_by: user?.name || null,
      updated_by: user?.name || null,
    };

    const casesData = cases.map((c, i) => ({
      case_id: c.case_id,
      case_name: c.case_name,
      ctas: c.ctas,
      semantic_words: c.semantic_words,
      case_info: c.case_info,
      qualification_script: c.qualification_script,
      zapsign_token: c.zapsign_token,
      zapsign_doc_token: c.zapsign_doc_token,
      contract_fields: c.contract_fields,
      fees_text: c.fees_text,
      closing_model_text: c.closing_model_text,
      negotiation_text: c.negotiation_text,
      position: i,
    }));

    const ok = await createPrompt(promptData as any, casesData as any);
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold">Novo Prompt</h2>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              i === step ? 'bg-primary text-primary-foreground' :
              i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 0 && (
            <StepAgentSearch
              selected={selectedAgent}
              onSelect={setSelectedAgent}
              onNext={() => setStep(1)}
            />
          )}
          {step === 1 && (
            <StepTemplateSelect
              selectedId={selectedTemplate?.id || null}
              onSelect={setSelectedTemplate}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <StepAIConfig
              data={aiConfig}
              onChange={setAiConfig}
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <StepCaseSelect
              cases={cases}
              onChange={setCases}
              templateClosingModel={selectedTemplate?.closing_model_text || ''}
              onBack={() => setStep(2)}
              onSave={handleSave}
              saving={saving}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
