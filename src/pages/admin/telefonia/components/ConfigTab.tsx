import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Eye, EyeOff, Plus, Save, Trash2, Pencil, Webhook, X } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTelefoniaAdmin } from '../hooks/useTelefoniaAdmin';
import { toast } from 'sonner';
import type { PhoneConfig } from '../types';

export function ConfigTab() {
  const { configs, configsLoading, saveConfig, deleteConfig } = useTelefoniaAdmin();

  const [editing, setEditing] = useState<PhoneConfig | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [codAgent, setCodAgent] = useState('');
  const [domain, setDomain] = useState('');
  const [sipDomain, setSipDomain] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);

  // Token visibility per row
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api4com-webhook`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada');
  };

  const resetForm = () => {
    setCodAgent('');
    setDomain('');
    setSipDomain('');
    setToken('');
    setShowToken(false);
    setEditing(null);
    setIsAdding(false);
  };

  const openAdd = () => {
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (cfg: PhoneConfig) => {
    setCodAgent(cfg.cod_agent);
    setDomain(cfg.api4com_domain);
    setSipDomain(cfg.sip_domain || '');
    setToken(cfg.api4com_token);
    setShowToken(false);
    setEditing(cfg);
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!codAgent || !domain || !token) return;
    saveConfig.mutate(
      {
        ...(editing ? { id: editing.id } : {}),
        cod_agent: codAgent,
        api4com_domain: domain,
        api4com_token: token,
        sip_domain: sipDomain || undefined,
      } as any,
      { onSuccess: resetForm }
    );
  };

  const toggleRowToken = (id: number) => {
    setVisibleTokens((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const maskToken = (t: string) => t.length > 8 ? t.slice(0, 4) + '••••••••' + t.slice(-4) : '••••••••';

  if (configsLoading) {
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Webhook Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="h-5 w-5" /> Webhook
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">URL do Webhook (configure manualmente no painel do provedor)</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopyUrl} title="Copiar URL">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Eventos capturados: <strong>channel-create</strong>, <strong>channel-answer</strong>, <strong>channel-hangup</strong>
          </p>
        </CardContent>
      </Card>

      {/* Configs per agent */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Configurações por Agente</CardTitle>
          {!isAdding && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4 mr-1" /> Nova Configuração
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add/Edit form */}
          {isAdding && (
            <Card className="border-dashed">
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{editing ? 'Editar Configuração' : 'Nova Configuração'}</p>
                  <Button variant="ghost" size="icon" onClick={resetForm}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cód. Agente</Label>
                    <Input value={codAgent} onChange={(e) => setCodAgent(e.target.value)} placeholder="202601001" disabled={!!editing} />
                  </div>
                  <div>
                    <Label>Domínio API (REST)</Label>
                    <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="api.provedor.com" />
                  </div>
                  <div>
                    <Label>Domínio SIP (WebRTC)</Label>
                    <Input value={sipDomain} onChange={(e) => setSipDomain(e.target.value)} placeholder="seudominio.provedor.com" />
                  </div>
                  <div>
                    <Label>Token</Label>
                    <div className="flex gap-1">
                      <Input
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        type={showToken ? 'text' : 'password'}
                        placeholder="Token de acesso"
                        className="flex-1"
                      />
                      <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)} type="button">
                        {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <Button onClick={handleSave} disabled={saveConfig.isPending || !codAgent || !domain || !token}>
                  <Save className="h-4 w-4 mr-1" /> {editing ? 'Atualizar' : 'Salvar'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Table */}
          {configs.length === 0 && !isAdding ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma configuração cadastrada</p>
          ) : configs.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cód. Agente</TableHead>
                  <TableHead>Domínio API</TableHead>
                  <TableHead>Domínio SIP</TableHead>
                  <TableHead>Token</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((cfg) => (
                  <TableRow key={cfg.id}>
                    <TableCell className="font-mono text-xs">{cfg.cod_agent}</TableCell>
                    <TableCell className="text-xs">{cfg.api4com_domain}</TableCell>
                    <TableCell className="text-xs">{cfg.sip_domain || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs">
                          {visibleTokens.has(cfg.id) ? cfg.api4com_token : maskToken(cfg.api4com_token)}
                        </span>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleRowToken(cfg.id)}>
                          {visibleTokens.has(cfg.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cfg)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover configuração?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A configuração do agente <strong>{cfg.cod_agent}</strong> será removida permanentemente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteConfig.mutate(cfg.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
