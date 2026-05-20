import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Brain, AudioLines, Sparkles, Loader2 } from 'lucide-react';
import { useChatClientSettings } from '@/hooks/useChatClientSettings';

/**
 * Per-client (not per-agent) automation settings:
 * - auto_transcribe_audio: transcribes inbound/outbound audio for every queue
 *   of this client.
 * - auto_summary_on_resolve / auto_summary_on_close: when on, generates an
 *   automatic conversation summary on resolve/close and enables the "Resumos"
 *   tab in the chat contact details.
 *
 * Stored in `chat_client_settings.settings` (JSONB).
 */
export function InteligenciaAtendimentoTab() {
  const { settings, isLoading, update } = useChatClientSettings();

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start gap-3">
        <Brain className="h-6 w-6 text-primary mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Inteligência de Atendimento
          </h2>
          <p className="text-sm text-muted-foreground">
            Configurações por <strong>cliente</strong> que afetam todas as filas e
            agentes. As mudanças são aplicadas em até 1 minuto.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Automação por cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <AudioLines className="h-3.5 w-3.5 text-cyan-600" />
                    Transcrever Áudio automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Toda mensagem de áudio (recebida ou enviada) em qualquer fila
                    deste cliente será transcrita automaticamente em segundo plano.
                  </p>
                </div>
                <Switch
                  checked={settings.auto_transcribe_audio}
                  disabled={update.isPending}
                  onCheckedChange={(v) => update.mutate({ auto_transcribe_audio: v })}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    Resumo automático ao Resolver
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ao marcar uma conversa como resolvida, gera um resumo automático
                    e adiciona como nota interna. Habilita a aba "Resumos" nos
                    detalhes do contato.
                  </p>
                </div>
                <Switch
                  checked={settings.auto_summary_on_resolve}
                  disabled={update.isPending}
                  onCheckedChange={(v) => update.mutate({ auto_summary_on_resolve: v })}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Label className="flex items-center gap-2 text-sm font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                    Resumo automático ao Encerrar
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ao encerrar manualmente uma conversa, gera um resumo automático
                    e adiciona como nota interna. Encerramentos em lote não disparam
                    resumo. Habilita a aba "Resumos" nos detalhes do contato.
                  </p>
                </div>
                <Switch
                  checked={settings.auto_summary_on_close}
                  disabled={update.isPending}
                  onCheckedChange={(v) => update.mutate({ auto_summary_on_close: v })}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}