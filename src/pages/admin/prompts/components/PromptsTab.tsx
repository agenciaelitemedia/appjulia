import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Pencil, Trash2, Eye, History, Copy, Check, Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { externalDb } from '@/lib/externalDb';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { useAgentPrompts, AgentPrompt, AgentPromptCase } from '../hooks/useAgentPrompts';
import { AgentPromptWizard } from './AgentPromptWizard';
import { AgentPromptHistoryDialog } from './AgentPromptHistoryDialog';
import { AgentPromptVersion } from '../hooks/useAgentPromptVersions';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type RoleFilter = 'all' | 'sdr' | 'closer';

export function PromptsTab() {
  const { user } = useAuth();
  const { prompts, isLoading, fetchPrompts, fetchCases, deletePrompt, updatePrompt, markAsPublished } = useAgentPrompts();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [isCloserMap, setIsCloserMap] = useState<Record<string, boolean>>({});
  const [showWizard, setShowWizard] = useState(false);
  const [copied, setCopied] = useState(false);

  // Batch-fetch is_closer from external DB for all unique cod_agents
  useEffect(() => {
    if (prompts.length === 0) return;
    const codAgents = [...new Set(prompts.map(p => p.cod_agent))];
    externalDb.raw<{ cod_agent: string; is_closer: boolean }>({
      query: `SELECT cod_agent::text AS cod_agent, is_closer FROM agents WHERE cod_agent::text = ANY($1)`,
      params: [codAgents],
    }).then(rows => {
      const map: Record<string, boolean> = {};
      for (const r of rows ?? []) map[String(r.cod_agent)] = !!r.is_closer;
      setIsCloserMap(map);
    }).catch(() => {/* non-critical */});
  }, [prompts]);

  // Publish
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // View
  const [viewing, setViewing] = useState<AgentPrompt | null>(null);
  const [viewCases, setViewCases] = useState<AgentPromptCase[]>([]);

  // Edit
  const [editingPrompt, setEditingPrompt] = useState<AgentPrompt | null>(null);
  const [editingCases, setEditingCases] = useState<AgentPromptCase[]>([]);

  // Delete
  const [deleting, setDeleting] = useState<AgentPrompt | null>(null);
  const [deleteTypedName, setDeleteTypedName] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // History
  const [historyPrompt, setHistoryPrompt] = useState<AgentPrompt | null>(null);

  const filtered = prompts.filter(p => {
    const matchText = `${p.cod_agent} ${p.agent_name} ${p.business_name}`.toLowerCase().includes(search.toLowerCase());
    if (!matchText) return false;
    if (roleFilter === 'all') return true;
    const isCloser = isCloserMap[p.cod_agent] ?? false;
    return roleFilter === 'closer' ? isCloser : !isCloser;
  });

  const openView = async (p: AgentPrompt) => {
    setViewing(p);
    const c = await fetchCases(p.id);
    setViewCases(c);
  };

  const openDelete = (p: AgentPrompt) => {
    setDeleting(p);
    setDeleteTypedName('');
    setDeleteConfirmed(false);
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteLoading(true);
    await deletePrompt(deleting.id);
    setDeleteLoading(false);
    setDeleting(null);
  };

  const deleteLabel = deleting ? `[${deleting.cod_agent}] - ${deleting.agent_name}` : '';
  const deleteNameMatch = deleting ? deleteTypedName === deleteLabel : false;
  const canDelete = deleteNameMatch && deleteConfirmed && !deleteLoading;

  const openHistory = (p: AgentPrompt) => {
    setHistoryPrompt(p);
  };

  const handleRestoreVersion = async (version: AgentPromptVersion) => {
    const snap = version.snapshot as any;
    if (!snap?.prompt || !historyPrompt) return;
    const { id, is_active, created_at, updated_at, ...promptData } = snap.prompt;
    const cases = (snap.cases || []).map((c: any) => {
      const { id: _id, agent_prompt_id: _apId, created_at: _ca, ...rest } = c;
      return rest;
    });
    await updatePrompt(historyPrompt.id, promptData, cases, snap.prompt.updated_by || null);
  };

  const openEdit = async (p: AgentPrompt) => {
    const c = await fetchCases(p.id);
    setEditingPrompt(p);
    setEditingCases(c);
  };

  const handleCopyPrompt = async () => {
    if (viewing?.generated_prompt) {
      await navigator.clipboard.writeText(viewing.generated_prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePublish = async () => {
    if (!viewing?.generated_prompt || !viewing.cod_agent) return;
    setPublishing(true);
    try {
      // Buscar agent_id numérico no banco externo via cod_agent
      const matches = await externalDb.searchAgents<{ id: number; cod_agent: string }>(viewing.cod_agent);
      const agent = matches?.find(a => String(a.cod_agent) === String(viewing.cod_agent));
      if (!agent?.id) {
        toast.error(`Agente ${viewing.cod_agent} não encontrado no sistema externo.`);
        return;
      }
      // Buscar dados atuais do agente para preservar settings e demais campos
      const current = await externalDb.getAgentDetails<any>(agent.id);
      let safeSettings: any = current?.settings;
      if (typeof safeSettings === 'string') {
        try { safeSettings = JSON.parse(safeSettings); } catch { safeSettings = {}; }
      }
      if (!safeSettings || typeof safeSettings !== 'object' || Array.isArray(safeSettings)) {
        safeSettings = {};
      }
      // Sobrescreve START_CAMPAIGN com todas as CTAs dos casos vinculados, separadas por ||
      const allCtas = (viewCases ?? [])
        .flatMap(c => Array.isArray(c.ctas) ? (c.ctas as string[]) : [])
        .map(s => String(s ?? '').trim())
        .filter(Boolean);
      safeSettings.START_CAMPAIGN = allCtas.join('||');
      await externalDb.updateAgent(agent.id, {
        settings: safeSettings,
        prompt: viewing.generated_prompt,
        is_closer: current?.is_closer ?? false,
        agent_plan_id: current?.agent_plan_id ?? null,
        due_date: current?.due_date ?? null,
        status: current?.status ?? true,
      } as any);
      await markAsPublished(viewing.id, user?.name);
      // Atualizar viewing local
      setViewing({
        ...viewing,
        prompt_published_at: new Date().toISOString(),
        prompt_published_by: user?.name || null,
      });
      toast.success(`Prompt publicado no agente ${viewing.cod_agent} com sucesso!`);
      setConfirmPublish(false);
    } catch (e: any) {
      console.error('Erro ao publicar prompt:', e);
      toast.error('Falha ao publicar prompt: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setPublishing(false);
    }
  };

  if (editingPrompt) {
    return (
      <AgentPromptWizard
        onClose={() => { setEditingPrompt(null); setEditingCases([]); }}
        onSaved={() => fetchPrompts()}
        editingPrompt={editingPrompt}
        editingCases={editingCases}
      />
    );
  }

  if (showWizard) {
    return (
      <AgentPromptWizard
        onClose={() => setShowWizard(false)}
        onSaved={() => fetchPrompts()}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Prompts dos Agentes</CardTitle>
            <CardDescription>Gerencie os prompts personalizados por agente</CardDescription>
          </div>
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" /> Novo Prompt
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por código ou nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <div className="flex rounded-md border overflow-hidden text-xs font-medium">
            {(['all', 'sdr', 'closer'] as RoleFilter[]).map(role => (
              <button
                key={role}
                onClick={() => setRoleFilter(role)}
                className={`px-3 py-2 transition-colors ${
                  roleFilter === role
                    ? role === 'closer'
                      ? 'bg-purple-600 text-white'
                      : role === 'sdr'
                        ? 'bg-blue-600 text-white'
                        : 'bg-primary text-primary-foreground'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {role === 'all' ? 'TODOS' : role.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-center text-muted-foreground py-8">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {search ? 'Nenhum prompt encontrado.' : 'Nenhum prompt cadastrado ainda.'}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map(p => (
              <Card key={p.id} className="relative group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">[{p.cod_agent}] - {p.agent_name}</CardTitle>
                      {p.business_name && <CardDescription>{p.business_name}</CardDescription>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="icon" variant="ghost" title="Visualizar" onClick={() => openView(p)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Editar" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Histórico" onClick={() => openHistory(p)}>
                        <History className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" title="Excluir" onClick={() => openDelete(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">IA: {p.ai_name || 'Julia'}</p>
                    {p.cod_agent in isCloserMap && (
                      isCloserMap[p.cod_agent]
                        ? <Badge className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400">CLOSER</Badge>
                        : <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400">SDR</Badge>
                    )}
                  </div>
                  <div className="mt-2 space-y-0.5">
                    <p className="text-[11px] text-muted-foreground/70">
                      Criado em {format(new Date(p.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      {p.created_by ? ` por ${p.created_by}` : ''}
                    </p>
                    {p.updated_at && p.updated_at !== p.created_at && (
                      <p className="text-[11px] text-muted-foreground/70">
                        Atualizado em {format(new Date(p.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {p.updated_by ? ` por ${p.updated_by}` : ''}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>

      {/* View Dialog */}
      <Dialog open={!!viewing} onOpenChange={o => { if (!o) { setViewing(null); setCopied(false); } }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>[{viewing?.cod_agent}] - {viewing?.agent_name}</DialogTitle>
            {viewing?.business_name && <DialogDescription>{viewing.business_name}</DialogDescription>}
            {viewing && (
              <div className="pt-1">
                {viewing.prompt_published_at ? (
                  <Badge variant="default">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Publicado em {format(new Date(viewing.prompt_published_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {viewing.prompt_published_by ? ` por ${viewing.prompt_published_by}` : ''}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Nunca publicado</Badge>
                )}
              </div>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {/* ZapSign Links Card */}
            {viewCases.some(c => c.zapsign_doc_token) && (
              <div className="w-full rounded-lg bg-muted p-4 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-2">🔗 ZapSign Links</p>
                {viewCases.filter(c => c.zapsign_doc_token).map(c => (
                  <div key={c.id} className="flex items-center gap-2 text-xs">
                    <span className="font-medium">{c.case_name}:</span>
                    <a
                      href={`https://app.zapsign.com.br/verificar/doc/${c.zapsign_doc_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all"
                    >
                      https://app.zapsign.com.br/verificar/doc/{c.zapsign_doc_token}
                    </a>
                  </div>
                ))}
              </div>
            )}

            {/* Cases with CTAs */}
            {viewCases.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Casos vinculados ({viewCases.length})</Label>
                <div className="border rounded-lg divide-y">
                  {viewCases.map(c => (
                    <div key={c.id} className="p-3">
                      <p className="text-sm font-medium">{c.case_name}</p>
                      {Array.isArray(c.ctas) && c.ctas.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(c.ctas as string[]).map((cta, i) => (
                            <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                              {cta}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Final */}
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Prompt Final Gerado</Label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
                  {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmPublish(true)}
                  disabled={!viewing?.generated_prompt || publishing}
                >
                  <Upload className="h-3 w-3 mr-1" />
                  Publicar
                </Button>
              </div>
            </div>
            {viewing?.generated_prompt ? (
              <Textarea
                value={viewing.generated_prompt}
                readOnly
                className="font-mono text-xs min-h-[400px] resize-y bg-muted"
              />
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhum prompt gerado ainda.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Publish Dialog */}
      <AlertDialog open={confirmPublish} onOpenChange={o => !publishing && setConfirmPublish(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publicar prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá <strong>substituir</strong> o prompt atual do agente <strong>{viewing?.cod_agent}</strong> ({viewing?.agent_name}) em produção.
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishing}>Cancelar</AlertDialogCancel>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? 'Publicando...' : 'Sim, publicar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Excluir Prompt</AlertDialogTitle>
            <AlertDialogDescription>Para confirmar, digite o identificador do prompt abaixo.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Identificador:</Label>
              <Input value={deleteLabel} readOnly className="bg-muted font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Digite para confirmar:</Label>
              <Input
                value={deleteTypedName}
                onChange={e => setDeleteTypedName(e.target.value)}
                placeholder="Digite o identificador exato..."
                className={deleteTypedName && !deleteNameMatch ? 'border-destructive' : ''}
                disabled={deleteLoading}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="del-confirm" checked={deleteConfirmed} onCheckedChange={c => setDeleteConfirmed(c === true)} disabled={deleteLoading} />
              <Label htmlFor="del-confirm" className="text-sm font-medium leading-none">Confirmo a exclusão permanente</Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete}>
              {deleteLoading ? 'Excluindo...' : 'Excluir'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* History Dialog */}
      <AgentPromptHistoryDialog
        prompt={historyPrompt}
        open={!!historyPrompt}
        onOpenChange={(o) => !o && setHistoryPrompt(null)}
        onRestore={handleRestoreVersion}
      />
    </Card>
  );
}
