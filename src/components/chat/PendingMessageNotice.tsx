import { useState } from 'react';
import { RotateCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { ChatMessage } from '@/types/chat';

/**
 * Aviso âmbar para mensagens que chegaram sem conteúdo legível
 * (falha de criptografia do WhatsApp) + botão para tentar buscar novamente.
 */
export function PendingMessageNotice({ message, text }: { message: ChatMessage; text?: string }) {
  const [loading, setLoading] = useState(false);

  const retry = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('uazapi-message-revalidate', {
        body: { mode: 'single', row_id: message.id, message_id: message.message_id || undefined },
      });
      if (error) throw error;
      if (data?.recovered) toast.success('Mensagem recuperada.');
      else if (data?.reason === 'already_has_content') toast.info('Esta mensagem já foi recuperada.');
      else toast.info('Conteúdo ainda não disponível. Vamos tentar novamente automaticamente.');
    } catch {
      toast.error('Não foi possível verificar agora. Tente em instantes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <p className="text-xs italic text-amber-600 dark:text-amber-400">
        {text || '🕐 Aguardando esta mensagem. Isso pode demorar um pouco.'}
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={loading}
        className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline disabled:opacity-60 dark:text-amber-300"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
        {loading ? 'Verificando...' : 'Tentar novamente'}
      </button>
    </div>
  );
}
