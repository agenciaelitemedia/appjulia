import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Archive, Bot, File, FileAudio, FileImage, FileText, FileVideo, Loader2, Pencil, Play, Plus, RefreshCw, StickyNote, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { type ContactMemoryItem, type MemoryCategory, type MemorySource, useContactMemory } from '@/hooks/useContactMemory';

const categoryLabels: Record<MemoryCategory, string> = {
  profile_context: 'Perfil e contexto',
  needs_case: 'Necessidades e caso',
  pains_objections: 'Dores e objeções',
  agreements_commitments: 'Acordos e compromissos',
  next_steps: 'Próximos passos',
  team_observations: 'Anotações da equipe',
};

type DownloadMedia = (messageId: string) => Promise<{ url?: string }>;

function stamp(value?: string | null) {
  if (!value) return '';
  try { return format(new Date(value), "dd MMM, HH:mm", { locale: ptBR }); } catch { return ''; }
}

function transcript(source: MemorySource) {
  return source.metadata?.transcription?.text || source.metadata?.transcription_internal?.text || source.text || source.caption || '';
}

export function ContactMemoryPanel({ contactId, downloadMedia }: { contactId: string; downloadMedia: DownloadMedia }) {
  const { data, isLoading, error, refetch, runAction, isActing } = useContactMemory(contactId);
  const [editor, setEditor] = useState<{ item?: ContactMemoryItem; category: MemoryCategory; content: string } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const grouped = useMemo(() => {
    const groups = {} as Record<MemoryCategory, ContactMemoryItem[]>;
    Object.keys(categoryLabels).forEach((key) => { groups[key as MemoryCategory] = []; });
    data?.items.forEach((item) => groups[item.category].push(item));
    return groups;
  }, [data?.items]);

  const generate = async () => {
    try {
      const result = await runAction({ action: 'generate' }) as { items?: unknown[]; transcription_failures?: string[] };
      const count = result.items?.length ?? 0;
      toast.success(count ? `${count} lembrança${count === 1 ? '' : 's'} adicionada${count === 1 ? '' : 's'}` : 'Memória revisada sem novas informações');
      if (result.transcription_failures?.length) toast.warning('Alguns áudios não puderam ser transcritos.');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível gerar a memória'); }
  };

  const save = async () => {
    if (!editor?.content.trim()) return;
    try {
      await runAction(editor.item
        ? { action: 'update', item_id: editor.item.id, category: editor.category, content: editor.content.trim() }
        : { action: 'create', category: editor.category, content: editor.content.trim() });
      setEditor(null);
      toast.success(editor.item ? 'Memória atualizada' : 'Anotação adicionada');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível salvar'); }
  };

  const archive = async (item: ContactMemoryItem) => {
    try { await runAction({ action: 'archive', item_id: item.id }); toast.success('Item arquivado'); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível arquivar'); }
  };

  const openMedia = async (source: MemorySource) => {
    setPlayingId(source.id);
    try {
      const direct = /^https?:\/\//.test(source.media_url || '') && !source.media_url?.includes('.enc') ? source.media_url : undefined;
      const result = direct ? { url: direct } : await downloadMedia(source.id);
      if (!result.url) throw new Error('Arquivo ainda não disponível');
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : 'Não foi possível abrir o arquivo'); }
    finally { setPlayingId(null); }
  };

  if (isLoading) return <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground"><p>Não foi possível carregar a memória.</p><Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4" />Tentar novamente</Button></div>;

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="p-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0"><h3 className="font-semibold">Memória do contato</h3><p className="text-xs text-muted-foreground">Atualizada manualmente{data?.state?.last_generated_at ? ` · ${stamp(data.state.last_generated_at)}` : ''}</p></div>
        <div className="flex gap-1">
          {data?.can_edit && <Button variant="ghost" size="icon" title="Adicionar anotação" onClick={() => setEditor({ category: 'team_observations', content: '' })}><Plus className="h-4 w-4" /></Button>}
          {data?.can_edit && <Button size="sm" onClick={generate} disabled={isActing}><Bot className={cn('h-4 w-4', isActing && 'animate-pulse')} />Gerar memória</Button>}
        </div>
      </div>
      <Tabs defaultValue="memory" className="flex-1 min-h-0 flex flex-col">
        <TabsList className="mx-3 mt-3 grid grid-cols-2"><TabsTrigger value="memory">Memória</TabsTrigger><TabsTrigger value="documents">Documentos <Badge variant="secondary" className="ml-1">{data?.documents.length ?? 0}</Badge></TabsTrigger></TabsList>
        <TabsContent value="memory" className="flex-1 min-h-0 mt-0">
          <ScrollArea className="h-full"><div className="p-3 space-y-5">
            {!data?.items.length && <div className="border border-dashed rounded-md p-5 text-center text-sm text-muted-foreground">Nenhuma memória gerada ainda.</div>}
            {(Object.keys(categoryLabels) as MemoryCategory[]).map((category) => grouped[category]?.length ? <section key={category}>
              <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">{categoryLabels[category]}</h4>
              <div className="space-y-2">{grouped[category].map((item) => <div key={item.id} className="border rounded-md p-3 bg-card group">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.content}</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  {item.source_type === 'audio' ? <FileAudio className="h-3.5 w-3.5" /> : item.source_type === 'internal_note' || item.source_type === 'manual' ? <StickyNote className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                  <span>{item.source_author || (item.source_type === 'manual' ? 'Equipe' : 'Conversa')}</span><span>·</span><span>{stamp(item.source_at || item.created_at)}</span>
                  {item.confidence != null && <Badge variant="outline" className="ml-auto h-5">{Math.round(item.confidence * 100)}%</Badge>}
                  {item.source_type === 'audio' && item.source_message_id && <Button variant="ghost" size="icon" className="h-6 w-6" title="Ouvir áudio original" onClick={() => openMedia({ id: item.source_message_id || '', type: 'audio', from_me: false, timestamp: item.source_at || item.created_at })}>{playingId === item.source_message_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}</Button>}
                  {data.can_edit && <><Button variant="ghost" size="icon" className="h-6 w-6" title="Editar" onClick={() => setEditor({ item, category: item.category, content: item.content })}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-6 w-6" title="Arquivar" onClick={() => archive(item)}><Archive className="h-3.5 w-3.5" /></Button></>}
                </div>
              </div>)}</div>
            </section> : null)}
            {!!data?.summaries.length && <section><h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Resumos anteriores</h4><div className="space-y-2">{data.summaries.map((summary) => <details key={summary.id} className="border rounded-md p-3"><summary className="text-sm font-medium cursor-pointer">Resumo de {stamp(summary.created_at)}</summary><p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{summary.summary}</p></details>)}</div></section>}
            {!!data?.sources.length && <section><h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Fontes recentes</h4><div className="border-l ml-2 space-y-3">{data.sources.slice(0, 40).map((source) => <div key={source.id} className="pl-4 relative text-sm before:absolute before:h-2 before:w-2 before:rounded-full before:bg-muted-foreground before:-left-1 before:top-1.5"><div className="flex items-center gap-1 text-xs text-muted-foreground"><span>{source.internal_note ? 'Anotação da equipe' : source.from_me ? 'Atendente' : source.sender_name || 'Cliente'}</span><span>·</span><span>{stamp(source.timestamp)}</span>{['audio','ptt'].includes(source.type) && <Button variant="ghost" size="icon" className="h-6 w-6" title="Ouvir áudio" onClick={() => openMedia(source)}>{playingId === source.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}</Button>}</div><p className="whitespace-pre-wrap text-muted-foreground line-clamp-4">{transcript(source) || (['audio','ptt'].includes(source.type) ? 'Áudio ainda não transcrito' : 'Sem texto')}</p></div>)}</div></section>}
          </div></ScrollArea>
        </TabsContent>
        <TabsContent value="documents" className="flex-1 min-h-0 mt-0"><ScrollArea className="h-full"><div className="p-3 space-y-2">
          {!data?.documents.length && <div className="border border-dashed rounded-md p-5 text-center text-sm text-muted-foreground">Nenhum documento enviado neste contato.</div>}
          {data?.documents.map((document) => { const Icon = document.type === 'image' ? FileImage : document.type === 'video' ? FileVideo : document.type === 'document' ? FileText : File; return <button key={document.id} className="w-full border rounded-md p-3 text-left flex items-center gap-3 hover:bg-accent transition-colors" onClick={() => openMedia(document)}><div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{document.file_name || document.caption || `Arquivo ${document.type}`}</p><p className="text-xs text-muted-foreground">{document.from_me ? 'Enviado pelo escritório' : 'Enviado pelo cliente'} · {stamp(document.timestamp)}</p></div>{playingId === document.id && <Loader2 className="h-4 w-4 animate-spin" />}</button>; })}
        </div></ScrollArea></TabsContent>
      </Tabs>
      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}><DialogContent><DialogHeader><DialogTitle>{editor?.item ? 'Editar memória' : 'Adicionar anotação'}</DialogTitle><DialogDescription>Registre apenas informações úteis para os próximos atendimentos.</DialogDescription></DialogHeader>{editor && <div className="space-y-3"><Select value={editor.category} onValueChange={(category: MemoryCategory) => setEditor({ ...editor, category })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(categoryLabels) as MemoryCategory[]).map((category) => <SelectItem key={category} value={category}>{categoryLabels[category]}</SelectItem>)}</SelectContent></Select><Textarea value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} rows={7} maxLength={4000} /><Input readOnly value={`${editor.content.length}/4000`} className="h-7 text-xs text-right border-0" /></div>}<DialogFooter><Button variant="outline" onClick={() => setEditor(null)}>Cancelar</Button><Button onClick={save} disabled={!editor?.content.trim() || isActing}>{isActing && <Loader2 className="h-4 w-4 animate-spin" />}Salvar</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}