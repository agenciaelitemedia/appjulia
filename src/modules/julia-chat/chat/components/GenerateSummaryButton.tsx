import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConversationSummaries } from '@/hooks/useConversationSummaries';

interface GenerateSummaryButtonProps {
  conversationId: string | null;
  contactId: string | null;
  /** Somente ícone (usado na barra de envio) */
  iconOnly?: boolean;
  className?: string;
  /** Callback após gerar com sucesso (ex.: abrir aba de resumos) */
  onGenerated?: () => void;
}

/**
 * Botão para gerar manualmente o resumo do atendimento com IA.
 * Reutiliza a mesma lógica da aba "Resumos" (useConversationSummaries).
 */
export function GenerateSummaryButton({
  conversationId,
  contactId,
  iconOnly = false,
  className,
  onGenerated,
}: GenerateSummaryButtonProps) {
  const { generateSummary, getAfterTsForNext } = useConversationSummaries(conversationId, contactId);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!conversationId || !contactId || isGenerating) return;
    setIsGenerating(true);
    try {
      await generateSummary(conversationId, contactId, getAfterTsForNext(), 'manual');
      toast.success('Resumo gerado com sucesso');
      onGenerated?.();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar resumo');
    } finally {
      setIsGenerating(false);
    }
  };

  const disabled = !conversationId || !contactId || isGenerating;
  const Icon = isGenerating ? Loader2 : Sparkles;

  const button = (
    <Button
      type="button"
      variant="ghost"
      size={iconOnly ? 'icon' : 'sm'}
      onClick={handleGenerate}
      disabled={disabled}
      className={cn(
        'rounded-full text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/40',
        iconOnly && 'h-9 w-9',
        className,
      )}
    >
      <Icon className={cn('h-4 w-4', isGenerating && 'animate-spin', !iconOnly && 'mr-1.5')} />
      {!iconOnly && <span>Gerar Resumo</span>}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>
        {isGenerating ? 'Gerando resumo com IA...' : 'Gerar resumo do atendimento com IA'}
      </TooltipContent>
    </Tooltip>
  );
}