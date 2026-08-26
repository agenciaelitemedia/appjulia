import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../extend/db';
import type { DspSimulationResult } from '../types';

/**
 * Modo simulação: roda elegibilidade + supressão + frequência sem enfileirar
 * nem enviar nada, devolvendo o relatório do que seria disparado.
 */
export function useDspSimulation() {
  return useMutation<DspSimulationResult, any, { campaign_id: string }>({
    mutationFn: async ({ campaign_id }) => {
      const { data, error } = await supabase.functions.invoke('dsp-campaign-prepare', {
        body: { campaign_id, dry_run: true },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as DspSimulationResult;
    },
    onError: (e: any) => toast.error('Erro na simulação', { description: e?.message }),
  });
}
