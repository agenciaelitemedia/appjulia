import { useMemo } from 'react';
import { renderProtocolMaskPreview } from './mask';

/** Hook utilitário para pré-visualização de máscara de protocolo. */
export function useProtocolPreview(mask: string, seq = 1): string {
  return useMemo(() => renderProtocolMaskPreview(mask, seq), [mask, seq]);
}