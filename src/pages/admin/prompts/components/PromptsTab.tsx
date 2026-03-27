import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Plus, Search, Pencil, Trash2, Eye, History, Copy, Check } from 'lucide-react';
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

export function PromptsTab() {
  const { user } = useAuth();
  const { prompts, isLoading, fetchPrompts, fetchCases, deletePrompt, updatePrompt } = useAgentPrompts();
  const [search, setSearch] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const filtered = prompts.filter(p =>
    `${p.cod_agent} ${p.agent_name} ${p.business_name}`.toLowerCase().includes(search.toLowerCase())
  );

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
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por código ou nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
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
                  <p className="text-xs text-muted-foreground">IA: {p.ai_name || 'Julia'}</p>
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
                      href={`https://app.zapsign.com.br/verificar/${c.zapsign_doc_token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline break-all"
                    >
                      https://app.zapsign.com.br/verificar/{c.zapsign_doc_token}
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
              <Button variant="outline" size="sm" onClick={handleCopyPrompt}>
                {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                {copied ? 'Copiado!' : 'Copiar'}
              </Button>
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
