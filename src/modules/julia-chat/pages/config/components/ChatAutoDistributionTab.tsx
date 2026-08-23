import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GitFork, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { resolveEffectiveClientId } from '@/lib/resolveEffectiveClientId';
import { ChatRoutingContent } from '@/pages/chat/ChatRoutingPage';

/**
 * Aba "Distribuição Automática" — switch master por client_id
 * (chat_client_settings.settings.auto_distribution_enabled) + regras
 * embarcadas (ChatRoutingContent).
 */
export function ChatAutoDistributionTab() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const cid = await resolveEffectiveClientId(user, 'ChatAutoDistributionTab');
      if (!mounted) return;
      setClientId(cid);
      if (!cid) { setLoading(false); return; }
      const { data } = await supabase
        .from('chat_client_settings')
        .select('settings')
        .eq('client_id', cid)
        .maybeSingle();
      const s = (data?.settings ?? {}) as Record<string, unknown>;
      if (mounted) {
        setEnabled(Boolean(s.auto_distribution_enabled ?? false));
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user?.id, user?.client_id]);

  async function toggle(v: boolean) {
    if (!clientId) return;
    setSaving(true);
    setEnabled(v);
    try {
      const { data: row } = await supabase
        .from('chat_client_settings')
        .select('id, settings')
        .eq('client_id', clientId)
        .maybeSingle();
      const current = (row?.settings ?? {}) as Record<string, unknown>;
      const next = { ...current, auto_distribution_enabled: v };
      const { error } = await supabase
        .from('chat_client_settings')
        .upsert(
          { client_id: clientId, settings: next as never },
          { onConflict: 'client_id' },
        );
      if (error) throw error;
      toast.success(v ? 'Distribuição automática ativada' : 'Distribuição automática desativada');
    } catch (e: any) {
      setEnabled(!v);
      toast.error(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-md bg-primary/10 p-2">
              <GitFork className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Label className="text-base font-semibold cursor-pointer">
                  Distribuição automática ativada
                </Label>
                {enabled ? (
                  <Badge className="text-[10px] bg-emerald-500 hover:bg-emerald-500">Ativo</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <AlertCircle className="h-3 w-3" /> Inativo — regras não serão aplicadas
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                Quando ativada, toda nova conversa em status "pendente" sem responsável
                é avaliada pelas regras abaixo (ordem de prioridade) e atribuída
                automaticamente a um atendente disponível.
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={loading || saving || !clientId}
          />
        </div>
      </Card>

      <ChatRoutingContent />
    </div>
  );
}