import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Copy, RefreshCw, ShieldCheck, Loader2, ExternalLink } from 'lucide-react';
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
import { externalDb } from '@/lib/externalDb';
import { toast } from 'sonner';

interface EmbedRow {
  id: number;
  code: string;
  name: string;
  icon: string | null;
  menu_group: string | null;
  display_order: number;
  is_menu_visible: boolean;
  is_active: boolean;
  module_type: string;
  url_template: string;
  auth_mode: 'simple' | 'signed';
  hmac_ttl_seconds: number;
  iframe_sandbox: string;
  iframe_referrer_policy: string;
  open_in_new_tab: boolean;
  allowed_origins: string[] | null;
  variables: Record<string, unknown>;
  has_secret: boolean;
}

const MENU_GROUPS = ['PRINCIPAL', 'AGENTES DA JULIA', 'CRM', 'SISTEMA', 'COMERCIAL', 'ADMINISTRATIVO', 'FINANCEIRO', 'CONFIGURAÇÕES', 'OUTROS'];

function generateSecret() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function slugify(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function emptyEmbed(): Partial<EmbedRow> & { hmac_secret?: string } {
  return {
    code: '',
    name: '',
    icon: 'Plug',
    menu_group: 'OUTROS',
    display_order: 100,
    is_menu_visible: true,
    url_template: '',
    auth_mode: 'simple',
    hmac_ttl_seconds: 300,
    iframe_sandbox: 'allow-scripts allow-forms allow-same-origin',
    iframe_referrer_policy: 'strict-origin',
    open_in_new_tab: false,
    variables: {},
  };
}

export default function EmbedManagerPage() {
  const [rows, setRows] = useState<EmbedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editing, setEditing] = useState<(Partial<EmbedRow> & { hmac_secret?: string }) | null>(null);
  const [variablesText, setVariablesText] = useState('{}');
  const [saving, setSaving] = useState(false);
  // Quando true, o code acompanha automaticamente o slug do nome.
  // Vira false assim que o usuário edita o campo code manualmente.
  const [codeAuto, setCodeAuto] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await externalDb.listModuleEmbeds();
      setRows((data || []) as EmbedRow[]);
    } catch (e: any) {
      // Caso o sistema nunca tenha sido inicializado, tabela não existe
      if (/does not exist|relation/i.test(e?.message || '')) {
        setRows([]);
      } else {
        toast.error('Falha ao carregar: ' + (e?.message || 'erro'));
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleInit() {
    setInitializing(true);
    try {
      await externalDb.initEmbedSystem();
      toast.success('Sistema de embeds inicializado');
      await load();
    } catch (e: any) {
      toast.error('Falha ao inicializar: ' + (e?.message || 'erro'));
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    const fresh = emptyEmbed();
    setEditing(fresh);
    setVariablesText('{}');
    setCodeAuto(true);
    setEditOpen(true);
  }

  function openEdit(row: EmbedRow) {
    setEditing({ ...row, hmac_secret: undefined }); // não enviamos secret no edit a menos que rotacionar
    setVariablesText(JSON.stringify(row.variables || {}, null, 2));
    setCodeAuto(false); // ao editar registro existente, code é fixo (disabled)
    setEditOpen(true);
  }

  async function handleSave() {
    if (!editing) return;
    if (!editing.code?.trim()) { toast.error('Code é obrigatório'); return; }
    if (!editing.name?.trim()) { toast.error('Nome é obrigatório'); return; }
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
      await externalDb.upsertModuleEmbed({
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
      await externalDb.deleteModuleEmbed(deleteId);
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
            Configure sistemas externos para aparecerem como módulos do menu da Julia.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleInit} disabled={initializing}>
            {initializing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            Inicializar sistema
          </Button>
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
              Nenhum embed cadastrado. Clique em "Inicializar sistema" se for a primeira vez.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Auth</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell><Badge variant="secondary">{r.menu_group || 'OUTROS'}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={r.auth_mode === 'signed' ? 'default' : 'outline'}>
                        {r.auth_mode === 'signed' ? 'HMAC' : 'simples'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={r.url_template}>
                      {r.url_template}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => window.open(`/sys/${r.code}`, '_blank')}>
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
                {`{{userId}} {{clientId}} {{codAgent}} {{role}} {{email}} {{name}} {{timestamp}}`}
              </code>
            </DialogDescription>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Code (identificador único)</Label>
                  <Input
                    value={editing.code || ''}
                    disabled={isEditingExisting}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    placeholder="ex: bi_dashboard"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Nome (exibido no menu)</Label>
                  <Input
                    value={editing.name || ''}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Dashboard BI"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Ícone (lucide)</Label>
                  <Input
                    value={editing.icon || ''}
                    onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                    placeholder="Plug"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Grupo de menu</Label>
                  <Select value={editing.menu_group || 'OUTROS'} onValueChange={(v) => setEditing({ ...editing, menu_group: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MENU_GROUPS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    value={editing.display_order ?? 100}
                    onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                  />
                </div>
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
                        ? 'Secret existente está armazenado e nunca é exibido. Gere um novo apenas se rotacionar.'
                        : 'Clique em "Gerar" para criar um secret. Copie agora — não será exibido novamente.'}
                    </p>
                  )}
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Compartilhe este secret com o sistema externo para que ele valide o HMAC do ticket.
                  </p>
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
                  <Label>Visível no menu</Label>
                  <p className="text-xs text-muted-foreground">Desligue para ocultar sem remover.</p>
                </div>
                <Switch
                  checked={editing.is_menu_visible ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_menu_visible: v })}
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
              Isto remove o módulo do menu e suas permissões. A ação não pode ser desfeita.
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
