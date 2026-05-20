import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Building2, X, Loader2, Network, Settings2, History, AlertTriangle, Brain } from 'lucide-react';
import { ChatSettingsClientPicker } from './ChatSettingsClientPicker';
import {
  DEFAULT_CHAT_SETTINGS,
  useChatClientSettingsMutations,
  type ChatClientSettingRow,
  type ChatClientSettingsJson,
} from '../hooks/useChatClientSettings';
import type { SearchedClient } from '@/pages/agents/hooks/useClientSearch';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: ChatClientSettingRow | null;
}

interface SelectedClient {
  id: string;
  name: string;
  business_name: string | null;
}

const ADVANCED_TOGGLES: Array<{
  key: keyof ChatClientSettingsJson;
  label: string;
  description: string;
}> = [
  { key: 'SHOW_GROUPS_TAB', label: 'Mostrar aba "Grupos" no chat', description: 'Exibe a aba de grupos na sidebar (depende de "Permitir grupos")' },
  { key: 'NOTIFICATION_SOUND', label: 'Som de notificação', description: 'Toca um som ao receber novas mensagens' },
];

export function ChatSettingsDialog({ open, onOpenChange, editing }: Props) {
  const { upsertSettings } = useChatClientSettingsMutations();
  const [client, setClient] = useState<SelectedClient | null>(null);
  const [settings, setSettings] = useState<ChatClientSettingsJson>(DEFAULT_CHAT_SETTINGS);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setClient({
        id: editing.client_id,
        name: editing.client_name ?? `Cliente ${editing.client_id}`,
        business_name: editing.client_business_name,
      });
      setSettings({ ...DEFAULT_CHAT_SETTINGS, ...editing.settings });
    } else {
      setClient(null);
      setSettings(DEFAULT_CHAT_SETTINGS);
    }
  }, [open, editing]);

  const handleSelectClient = (c: SearchedClient) => {
    setClient({ id: String(c.id), name: c.name, business_name: c.business_name });
  };

  const updateField = <K extends keyof ChatClientSettingsJson>(key: K, value: ChatClientSettingsJson[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (!client) return;
    upsertSettings.mutate(
      {
        client_id: client.id,
        client_name: client.name,
        client_business_name: client.business_name,
        settings,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Configuração' : 'Nova Configuração'}</DialogTitle>
          <DialogDescription>
            {client
              ? 'Defina como o chat se comporta para este cliente'
              : 'Selecione o cliente para criar a configuração'}
          </DialogDescription>
        </DialogHeader>

        {!client ? (
          <ChatSettingsClientPicker onSelect={handleSelectClient} />
        ) : (
          <div className="space-y-6">
            {/* Selected client */}
            <div className="flex items-center justify-between p-3 border rounded-lg bg-accent/30">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {client.business_name || `ID ${client.id}`}
                  </p>
                </div>
              </div>
              {!editing && (
                <Button variant="ghost" size="sm" onClick={() => setClient(null)}>
                  <X className="h-4 w-4 mr-1" /> Trocar
                </Button>
              )}
            </div>

            {/* Filas */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Network className="h-4 w-4" /> Filas
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label>Total de filas permitidas</Label>
                  <p className="text-xs text-muted-foreground">Quantas filas este cliente pode criar</p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.QUEUE_LIMIT}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    updateField('QUEUE_LIMIT', Number.isFinite(v) && v > 0 ? v : 1);
                  }}
                  className="w-24 text-center"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Permitir grupos</Label>
                  <p className="text-xs text-muted-foreground">
                    Habilita o atendimento de grupos do WhatsApp (@g.us)
                  </p>
                </div>
                <Switch
                  checked={settings.ALLOW_GROUPS}
                  onCheckedChange={(v) => updateField('ALLOW_GROUPS', v)}
                />
              </div>
            </div>

            {/* Configurações avançadas */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Settings2 className="h-4 w-4" /> Configurações avançadas
              </div>
              <div className="space-y-3">
                {ADVANCED_TOGGLES.map((t) => (
                  <div key={String(t.key)} className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <Label className="text-sm">{t.label}</Label>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <Switch
                      checked={!!settings[t.key]}
                      onCheckedChange={(v) => updateField(t.key, v as never)}
                    />
                  </div>
                ))}

                <Separator />

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1">
                    <Label className="text-sm">Reabrir ticket após (horas)</Label>
                    <p className="text-xs text-muted-foreground">Janela para reabrir ticket fechado se cliente responder</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={720}
                    value={settings.AUTO_RESUME_AFTER_HOURS ?? 24}
                    onChange={(e) => updateField('AUTO_RESUME_AFTER_HOURS', parseInt(e.target.value, 10) || 0)}
                    className="w-24 text-center"
                  />
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5 flex-1">
                    <Label className="text-sm">Tamanho máximo de upload (MB)</Label>
                    <p className="text-xs text-muted-foreground">Limite por arquivo enviado no chat</p>
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={500}
                    value={settings.MAX_FILE_SIZE_MB ?? 16}
                    onChange={(e) => updateField('MAX_FILE_SIZE_MB', parseInt(e.target.value, 10) || 16)}
                    className="w-24 text-center"
                  />
                </div>
              </div>
            </div>

            {/* Histórico WhatsApp */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <History className="h-4 w-4" /> Histórico de Conversas (UaZAPI)
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  O UaZAPI armazena no máximo <strong>7 dias</strong> de mensagens. Valores maiores não trarão histórico adicional.
                </p>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-sm">Janela de sincronização (dias)</Label>
                  <p className="text-xs text-muted-foreground">
                    Período usado ao clicar em "Sincronizar Histórico" em uma fila UaZAPI
                  </p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={7}
                  value={settings.history_sync_days ?? 7}
                  onChange={(e) => updateField('history_sync_days', Math.min(7, parseInt(e.target.value, 10) || 7))}
                  className="w-24 text-center"
                />
              </div>
            </div>

            {/* Inteligência de Atendimento (master por cliente) */}
            <div className="space-y-4 border rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Brain className="h-4 w-4" /> Inteligência de Atendimento
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                Libera as funcionalidades para este cliente. O dono do escritório ainda
                precisa ativar individualmente em cada fila para que tenham efeito.
              </p>

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-sm">Transcrição automática de áudios</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite habilitar a transcrição em filas deste cliente
                  </p>
                </div>
                <Switch
                  checked={!!settings.auto_transcribe_audio}
                  onCheckedChange={(v) => updateField('auto_transcribe_audio', v)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-sm">Auto-resumo ao resolver atendimento</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite habilitar o resumo automático ao resolver em filas deste cliente
                  </p>
                </div>
                <Switch
                  checked={!!settings.auto_summary_on_resolve}
                  onCheckedChange={(v) => updateField('auto_summary_on_resolve', v)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5 flex-1">
                  <Label className="text-sm">Auto-resumo ao fechar atendimento</Label>
                  <p className="text-xs text-muted-foreground">
                    Permite habilitar o resumo automático ao fechar em filas deste cliente
                  </p>
                </div>
                <Switch
                  checked={!!settings.auto_summary_on_close}
                  onCheckedChange={(v) => updateField('auto_summary_on_close', v)}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!client || upsertSettings.isPending}>
            {upsertSettings.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
