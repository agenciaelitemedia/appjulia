import { useMemo, useState } from 'react';
import { Copy, Check, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { processFinalPrompt } from '../../constants/promptDefaults';
import { CaseData } from './CaseCustomizeDialog';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface StepFinalPromptProps {
  templatePromptText: string;
  aiConfig: {
    aiName: string;
    practiceAreas: string;
    workingHours: string;
    officeInfo: string;
    welcomeMessage: string;
  };
  cases: CaseData[];
  onBack: () => void;
  onSave: (generatedPrompt: string) => void;
  saving: boolean;
  codAgent?: string;
  promptId?: string;
  publishedAt?: string | null;
  publishedBy?: string | null;
}

export function StepFinalPrompt({
  templatePromptText,
  aiConfig,
  cases,
  onBack,
  onSave,
  saving,
  codAgent,
  promptId,
  publishedAt,
  publishedBy,
}: StepFinalPromptProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [localPublished, setLocalPublished] = useState<{ at: string; by: string | null } | null>(
    publishedAt ? { at: publishedAt, by: publishedBy ?? null } : null
  );

  const generatedPrompt = useMemo(() => {
    return processFinalPrompt(templatePromptText, aiConfig, cases);
  }, [templatePromptText, aiConfig, cases]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePublish = async () => {
    if (!codAgent || !generatedPrompt) {
      toast.error('Sem cod_agent ou prompt para publicar.');
      return;
    }
    setPublishing(true);
    try {
      const matches = await externalDb.searchAgents<{ id: number; cod_agent: string }>(codAgent);
      const agent = matches?.find(a => String(a.cod_agent) === String(codAgent));
      if (!agent?.id) {
        toast.error(`Agente ${codAgent} não encontrado no sistema externo.`);
        return;
      }
      const current = await externalDb.getAgentDetails<any>(agent.id);
      let safeSettings: any = current?.settings;
      if (typeof safeSettings === 'string') {
        try { safeSettings = JSON.parse(safeSettings); } catch { safeSettings = {}; }
      }
      if (!safeSettings || typeof safeSettings !== 'object' || Array.isArray(safeSettings)) {
        safeSettings = {};
      }
      // Sobrescreve START_CAMPAIGN com todas as CTAs dos casos, separadas por ||
      const allCtas = (cases ?? [])
        .flatMap((c: any) => Array.isArray(c?.ctas) ? (c.ctas as string[]) : [])
        .map((s: any) => String(s ?? '').trim())
        .filter(Boolean);
      safeSettings.START_CAMPAIGN = allCtas.join('||');
      await externalDb.updateAgent(agent.id, {
        settings: safeSettings,
        prompt: generatedPrompt,
        is_closer: current?.is_closer ?? false,
        agent_plan_id: current?.agent_plan_id ?? null,
        due_date: current?.due_date ?? null,
        status: current?.status ?? true,
      } as any);

      if (promptId) {
        const nowIso = new Date().toISOString();
        await supabase
          .from('generation_agent_prompts')
          .update({
            prompt_published_at: nowIso,
            prompt_published_by: user?.name || null,
          } as any)
          .eq('id', promptId);
        setLocalPublished({ at: nowIso, by: user?.name || null });
      }

      toast.success(`Prompt publicado no agente ${codAgent} com sucesso!`);
      setConfirmPublish(false);
    } catch (e: any) {
      console.error('Erro ao publicar prompt:', e);
      toast.error('Falha ao publicar prompt: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Prompt Final</h3>
          <p className="text-sm text-muted-foreground">Revise o prompt gerado com todas as substituições</p>
          {codAgent && (
            <div className="pt-2">
              {localPublished ? (
                <Badge variant="default">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Publicado em {format(new Date(localPublished.at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {localPublished.by ? ` por ${localPublished.by}` : ''}
                </Badge>
              ) : (
                <Badge variant="secondary">Nunca publicado</Badge>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </Button>
          {codAgent && (
            <Button size="sm" onClick={() => setConfirmPublish(true)} disabled={publishing}>
              <Upload className="h-4 w-4 mr-1" />
              Publicar
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1">
        <Textarea
          value={generatedPrompt}
          readOnly
          className="min-h-[500px] h-full font-mono text-sm bg-muted resize-none"
        />
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={() => onSave(generatedPrompt)} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Prompt'}
        </Button>
      </div>

      <AlertDialog open={confirmPublish} onOpenChange={o => !publishing && setConfirmPublish(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>substituir</strong> o prompt atual do agente <strong>{codAgent}</strong> em produção.
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publicando...' : 'Sim, publicar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
