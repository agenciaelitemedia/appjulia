import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, RefreshCw, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { embedConfig, type ModuleEmbedRow } from '@/lib/embedConfig';
import { toast } from 'sonner';

function generateSecret() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

type Editable = Partial<ModuleEmbedRow> & { hmac_secret?: string };

function emptyEmbed(): Editable {
  return {
    code: '',
    url_template: '',
    auth_mode: 'simple',
    hmac_ttl_seconds: 300,
    iframe_sandbox: 'allow-scripts allow-forms allow-same-origin',
    iframe_referrer_policy: 'strict-origin',
    open_in_new_tab: false,
    is_active: true,
    variables: {},
  };
}

export default function EmbedManagerPage() {
  const [rows, setRows] = useState<ModuleEmbedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editable | null>(null);
  const [variablesText, setVariablesText] = useState('{}');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await embedConfig.list();
      setRows(data || []);
    } catch (e: any) {
      toast.error('Falha ao carregar: ' + (e?.message || 'erro'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(emptyEmbed());
    setVariablesText('{}');
    setEditOpen(true);
  }

  function openEdit(row: ModuleEmbedRow) {
    setEditing({ ...row, hmac_secret: undefined });
    setVariablesText(JSON.stringify(row.variables || {}, null, 2));
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.code?.trim()) { toast.error('Code é obrigatório'); return; }
    if (!editing.url_template?.trim()) { toast.error('URL é obrigatória'); return; }
    if (!/^https?:\/\//i.test(editing.url_template)) { toast.error('URL deve começar com http:// ou https://'); return; }

    let parsedVars: Record<string, unknown> = {};
    try {
      parsedVars = JSON.parse(variablesText || '{}');
      if (typeof parsedVars !== 'object' || Array.isArray(parsedVars)) throw new Error('JSON inválido');
    } catch {
      toast.error('Variáveis precisam ser JSON válido (objeto)');
      return;
    }

    setSaving(true);
    try {
      await embedConfig.upsert({
        ...editing,
        code: editing.code.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
        variables: parsedVars,
      });
      toast.success('Embed salvo');
      setEditOpen(false);
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error('Falha ao salvar: ' + (e?.message || 'erro'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await embedConfig.remove(deleteId);
      toast.success('Embed removido');
      setDeleteId(null);
      await load();
    } catch (e: any) {
      toast.error('Falha ao remover: ' + (e?.message || 'erro'));
    }
  }

  function rotateSecret() {
    if (!editing) return;
    const s = generateSecret();
    setEditing({ ...editing, hmac_secret: s });
    toast.info('Secret gerado — copie agora, só ficará visível neste momento');
  }

  function copySecret() {
    if (editing?.hmac_secret) {
      navigator.clipboard.writeText(editing.hmac_secret);
      toast.success('Secret copiado');
    }
  }

  const isEditingExisting = useMemo(() => !!editing?.id, [editing]);

  return (
    <div className="container mx-auto py-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Embeds Externos</h1>
          <p className="text-sm text-muted-foreground">
            Configure sistemas externos para serem acessados via /embed/&lt;code&gt;. A configuração técnica é armazenada no Lovable Cloud; o registro do menu permanece nos módulos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Recarregar
          </Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Novo embed</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Embeds cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum embed cadastrado. Clique em "Novo embed" para começar.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>
                      <Badge variant={r.auth_mode === 'signed' ? 'default' : 'outline'}>
                        {r.auth_mode === 'signed' ? (r.has_secret ? 'HMAC' : 'HMAC sem secret') : 'simples'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={r.url_template}>
                      {r.url_template}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_active ? 'secondary' : 'outline'}>
                        {r.is_active ? 'ativo' : 'inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => window.open(`/embed/${r.code}`, '_blank')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDeleteId(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={(o) => { if (!o) { setEditOpen(false); setEditing(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditingExisting ? 'Editar embed' : 'Novo embed'}</DialogTitle>
            <DialogDescription>
              Variáveis disponíveis no template:
              <code className="block mt-1 text-xs bg-muted p-2 rounded">
                {`{{userId}} {{clientId}} {{codAgent}} {{role}} {{email}} {{name}} {{timestamp}} {{ticket}} {{signature}}`}
              </code>
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Code (identificador único — também é a rota /embed/&lt;code&gt;)</Label>
                <Input
                  value={editing.code || ''}
                  disabled={isEditingExisting}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  placeholder="ex: bi_dashboard"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Para aparecer no menu, registre um módulo no banco externo com este mesmo code.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label>URL template</Label>
                <Input
                  value={editing.url_template || ''}
                  onChange={(e) => setEditing({ ...editing, url_template: e.target.value })}
                  placeholder="https://app.exemplo.com?u={{userId}}&c={{clientId}}"
                  className="font-mono text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Modo de autenticação</Label>
                  <Select value={editing.auth_mode || 'simple'} onValueChange={(v) => setEditing({ ...editing, auth_mode: v as 'simple' | 'signed' })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simples (substituição apenas)</SelectItem>
                      <SelectItem value="signed">HMAC assinado (recomendado)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>TTL do ticket (segundos)</Label>
                  <Input
                    type="number"
                    value={editing.hmac_ttl_seconds ?? 300}
                    onChange={(e) => setEditing({ ...editing, hmac_ttl_seconds: Number(e.target.value) })}
                    disabled={editing.auth_mode !== 'signed'}
                  />
                </div>
              </div>

              {editing.auth_mode === 'signed' && (
                <div className="rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm">HMAC secret</Label>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={rotateSecret}>
                        {isEditingExisting ? 'Gerar novo' : 'Gerar'}
                      </Button>
                      {editing.hmac_secret && (
                        <Button size="sm" variant="outline" onClick={copySecret}>
                          <Copy className="h-3 w-3 mr-1" />Copiar
                        </Button>
                      )}
                    </div>
                  </div>
                  {editing.hmac_secret ? (
                    <code className="block text-xs bg-background p-2 rounded break-all">{editing.hmac_secret}</code>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {isEditingExisting
                        ? 'Secret existente está armazenado no servidor e nunca é exibido. Gere um novo apenas se rotacionar.'
                        : 'Clique em "Gerar" para criar um secret. Copie agora — não será exibido novamente.'}
                    </p>
                  )}
                  <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                    <p className="font-semibold">Como o sistema externo valida:</p>
                    <code className="block bg-background/60 p-2 rounded text-[10px] leading-tight">
                      ticket    = base64url(JSON{`{userId, clientId, codAgent, role, email, iat, exp, nonce}`}){"\n"}
                      signature = HMAC_SHA256(secret, ticket)  // hex{"\n\n"}
                      validar:{"\n"}
                      1. recompute HMAC_SHA256(secret, ticket) === signature{"\n"}
                      2. JSON.parse(base64urlDecode(ticket)) -&gt; checar exp &gt; now(){"\n"}
                      3. opcional: cache de nonce por TTL
                    </code>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Iframe sandbox</Label>
                  <Input
                    value={editing.iframe_sandbox || ''}
                    onChange={(e) => setEditing({ ...editing, iframe_sandbox: e.target.value })}
                    placeholder="allow-scripts allow-forms allow-same-origin"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Referrer policy</Label>
                  <Select value={editing.iframe_referrer_policy || 'strict-origin'} onValueChange={(v) => setEditing({ ...editing, iframe_referrer_policy: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-referrer">no-referrer</SelectItem>
                      <SelectItem value="strict-origin">strict-origin</SelectItem>
                      <SelectItem value="same-origin">same-origin</SelectItem>
                      <SelectItem value="origin">origin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded border p-3">
                <div className="space-y-0.5">
                  <Label>Abrir em nova aba</Label>
                  <p className="text-xs text-muted-foreground">
                    Use quando o sistema externo bloqueia framing (X-Frame-Options).
                  </p>
                </div>
                <Switch
                  checked={!!editing.open_in_new_tab}
                  onCheckedChange={(v) => setEditing({ ...editing, open_in_new_tab: v })}
                />
              </div>

              <div className="flex items-center justify-between rounded border p-3">
                <div className="space-y-0.5">
                  <Label>Ativo</Label>
                  <p className="text-xs text-muted-foreground">Desligue para desabilitar sem remover.</p>
                </div>
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label>Variáveis customizadas (JSON)</Label>
                <Textarea
                  value={variablesText}
                  onChange={(e) => setVariablesText(e.target.value)}
                  placeholder='{"theme": "dark", "locale": "pt-BR"}'
                  className="font-mono text-xs min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditing(null); }}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover embed?</AlertDialogTitle>
            <AlertDialogDescription>
              Isto remove apenas a configuração técnica. O módulo no menu (se existir) precisa ser removido separadamente. A ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
