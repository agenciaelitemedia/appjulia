import { useMemo, useRef, useState } from 'react';
import {
  Plus, Pencil, Trash2, Zap, Search, FileText, Image as ImageIcon, Video,
  Mic, Paperclip, Link as LinkIcon, Loader2, Upload, X, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useQuickMessages, type QuickMessage } from '@/hooks/useQuickMessages';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AVAILABLE_VARIABLES, interpolateVariables } from '@/lib/messageVariables';

type Kind = 'text' | 'image' | 'video' | 'audio' | 'document' | 'link';

const KIND_META: Record<Kind, { label: string; icon: any; accept?: string }> = {
  text:     { label: 'Texto',     icon: FileText },
  image:    { label: 'Imagem',    icon: ImageIcon, accept: 'image/*' },
  video:    { label: 'Vídeo',     icon: Video,     accept: 'video/*' },
  audio:    { label: 'Áudio',     icon: Mic,       accept: 'audio/*' },
  document: { label: 'Documento', icon: Paperclip, accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip' },
  link:     { label: 'Link',      icon: LinkIcon },
};

const PREVIEW_CTX = {
  contactName: 'João da Silva',
  protocol: '#2026-000123',
  agentName: 'Você',
};

function VariableChips({ onInsert, withDays = true }: { onInsert: (token: string) => void; withDays?: boolean }) {
  const [xDays, setXDays] = useState(3);
  return (
    <div className="flex flex-wrap gap-1.5">
      {AVAILABLE_VARIABLES.filter(v => v.key !== 'data_hoje+Xd').map(v => (
        <button
          key={v.key}
          type="button"
          onClick={() => onInsert(`{{${v.key}}}`)}
          className="text-[11px] px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors font-mono"
          title={v.label}
        >
          {`{{${v.key}}}`}
        </button>
      ))}
      {withDays && (
        <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-muted">
          <span className="font-mono">{`{{data_hoje+`}</span>
          <Input
            type="number"
            min={1}
            value={xDays}
            onChange={e => setXDays(Math.max(1, parseInt(e.target.value) || 1))}
            className="h-5 w-12 text-[11px] px-1 py-0"
          />
          <span className="font-mono">{`d}}`}</span>
          <button
            type="button"
            onClick={() => onInsert(`{{data_hoje+${xDays}d}}`)}
            className="ml-1 text-primary hover:underline font-medium"
          >
            inserir
          </button>
        </span>
      )}
    </div>
  );
}

export default function QuickMessagesPage() {
  const { allMessages, isLoadingAll, create, update, remove, isCreating, isUpdating, isDeleting } = useQuickMessages();
  const { toast } = useToast();
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<QuickMessage | null>(null);

  // Form state
  const [kind, setKind] = useState<Kind>('text');
  const [title, setTitle] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [active, setActive] = useState(true);
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaPath, setMediaPath] = useState<string | null>(null);
  const [mediaMime, setMediaMime] = useState<string | null>(null);
  const [mediaSize, setMediaSize] = useState<number | null>(null);
  const [mediaFilename, setMediaFilename] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkImage, setLinkImage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fetchingPreview, setFetchingPreview] = useState(false);

  const textRef = useRef<HTMLTextAreaElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setEditing(null);
    setKind('text');
    setTitle(''); setShortcut(''); setActive(true);
    setText(''); setCaption('');
    setMediaUrl(null); setMediaPath(null); setMediaMime(null);
    setMediaSize(null); setMediaFilename(null);
    setLinkUrl(''); setLinkTitle(''); setLinkDescription(''); setLinkImage('');
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (m: QuickMessage) => {
    setEditing(m);
    setKind((m.kind || 'text') as Kind);
    setTitle(m.title);
    setShortcut(m.shortcut || '');
    setActive(m.is_active);
    setText(m.kind === 'text' ? (m.message_text || '') : '');
    setCaption(m.kind !== 'text' && m.kind !== 'link' ? (m.message_text || '') : '');
    setMediaUrl(m.media_url); setMediaPath(m.media_path); setMediaMime(m.media_mime);
    setMediaSize(m.media_size); setMediaFilename(m.media_filename);
    setLinkUrl(m.link_url || ''); setLinkTitle(m.link_title || '');
    setLinkDescription(m.link_description || ''); setLinkImage(m.link_image || '');
    if (m.kind === 'link') setText(m.message_text || '');
    setDialogOpen(true);
  };

  const insertAt = (ref: React.RefObject<HTMLTextAreaElement>, getter: () => string, setter: (v: string) => void, token: string) => {
    const ta = ref.current;
    const val = getter();
    if (!ta) { setter(val + token); return; }
    const s = ta.selectionStart ?? val.length;
    const e = ta.selectionEnd ?? val.length;
    const next = val.slice(0, s) + token + val.slice(e);
    setter(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + token.length, s + token.length); }, 0);
  };

  const handleFile = async (file: File) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `quick-messages/${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('chat-media').upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('chat-media').getPublicUrl(path);
      setMediaUrl(data.publicUrl);
      setMediaPath(path);
      setMediaMime(file.type);
      setMediaSize(file.size);
      setMediaFilename(file.name);
    } catch (err: any) {
      toast({ title: 'Erro no upload', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const fetchLinkPreview = async () => {
    if (!linkUrl.trim()) return;
    setFetchingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('link-preview', { body: { url: linkUrl.trim() } });
      if (error) throw error;
      const p = (data as any)?.preview ?? data;
      if (p?.title) setLinkTitle(p.title);
      if (p?.description) setLinkDescription(p.description);
      if (p?.image) setLinkImage(p.image);
    } catch (err: any) {
      toast({ title: 'Não foi possível buscar preview', description: err.message, variant: 'destructive' });
    } finally {
      setFetchingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Informe o título', variant: 'destructive' });
      return;
    }
    if (kind === 'text' && !text.trim()) {
      toast({ title: 'Informe o texto da mensagem', variant: 'destructive' });
      return;
    }
    if (['image','video','audio','document'].includes(kind) && !mediaUrl) {
      toast({ title: 'Envie o arquivo', variant: 'destructive' });
      return;
    }
    if (kind === 'link' && !linkUrl.trim()) {
      toast({ title: 'Informe a URL do link', variant: 'destructive' });
      return;
    }

    const payload: any = {
      title: title.trim(),
      shortcut: shortcut.trim() || null,
      category: 'geral',
      use_locations: ['chat_module'],
      is_active: active,
      kind,
      message_text: kind === 'text' ? text.trim() : (kind === 'link' ? text.trim() : caption.trim() || null),
      media_url: mediaUrl,
      media_path: mediaPath,
      media_mime: mediaMime,
      media_size: mediaSize,
      media_filename: mediaFilename,
      link_url: kind === 'link' ? linkUrl.trim() : null,
      link_title: kind === 'link' ? (linkTitle || null) : null,
      link_description: kind === 'link' ? (linkDescription || null) : null,
      link_image: kind === 'link' ? (linkImage || null) : null,
    };

    try {
      if (editing) {
        await update({ id: editing.id, ...payload });
        toast({ title: 'Mensagem atualizada' });
      } else {
        await create(payload);
        toast({ title: 'Mensagem criada' });
      }
      setDialogOpen(false);
      resetForm();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const msg = allMessages.find(m => m.id === deleteId);
    try {
      if (msg?.media_path) {
        await supabase.storage.from('chat-media').remove([msg.media_path]).catch(() => null);
      }
      await remove(deleteId);
      toast({ title: 'Mensagem excluída' });
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err.message, variant: 'destructive' });
    } finally { setDeleteId(null); }
  };

  const filtered = useMemo(() => allMessages.filter(m =>
    m.title.toLowerCase().includes(search.toLowerCase()) ||
    (m.message_text || '').toLowerCase().includes(search.toLowerCase()) ||
    (m.shortcut || '').toLowerCase().includes(search.toLowerCase())
  ), [allMessages, search]);

  const textPreview = useMemo(() => interpolateVariables(text, PREVIEW_CTX), [text]);
  const captionPreview = useMemo(() => interpolateVariables(caption, PREVIEW_CTX), [caption]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Mensagens Rápidas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Modelos prontos para usar no chat — texto, mídia e links com preview.
          </p>
        </div>
        <Button onClick={openCreate} className="rounded-full">
          <Plus className="h-4 w-4 mr-2" />
          Nova Mensagem
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoadingAll ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">
              {search ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem rápida cadastrada'}
            </p>
            {!search && (
              <Button variant="outline" className="mt-4 rounded-full" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Criar primeira mensagem
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map(msg => {
            const k = (msg.kind || 'text') as Kind;
            const Icon = KIND_META[k].icon;
            return (
              <Card key={msg.id} className={!msg.is_active ? 'opacity-60' : ''}>
                <CardContent className="flex items-start gap-4 py-4">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-sm">{msg.title}</span>
                      <Badge variant="outline" className="text-[10px]">{KIND_META[k].label}</Badge>
                      {msg.shortcut && <Badge variant="secondary" className="text-xs">/{msg.shortcut}</Badge>}
                      {!msg.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                    </div>
                    {k === 'text' && (
                      <p className="text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{msg.message_text}</p>
                    )}
                    {(k === 'image' || k === 'video') && msg.media_url && (
                      <div className="flex items-center gap-3 mt-1">
                        {k === 'image' ? (
                          <img src={msg.media_url} alt="" className="h-16 w-16 rounded object-cover" />
                        ) : (
                          <video src={msg.media_url} className="h-16 w-24 rounded object-cover bg-black" />
                        )}
                        {msg.message_text && <p className="text-xs text-muted-foreground line-clamp-2 flex-1">{msg.message_text}</p>}
                      </div>
                    )}
                    {k === 'audio' && msg.media_url && (
                      <audio controls src={msg.media_url} className="h-8 mt-1 max-w-xs" />
                    )}
                    {k === 'document' && (
                      <p className="text-xs text-muted-foreground mt-1">📎 {msg.media_filename}</p>
                    )}
                    {k === 'link' && (
                      <div className="flex gap-3 mt-1 items-center">
                        {msg.link_image && <img src={msg.link_image} alt="" className="h-12 w-12 rounded object-cover" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{msg.link_title || msg.link_url}</p>
                          {msg.link_description && <p className="text-xs text-muted-foreground line-clamp-1">{msg.link_description}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="rounded-full" onClick={() => openEdit(msg)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="rounded-full" onClick={() => setDeleteId(msg.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Mensagem Rápida' : 'Nova Mensagem Rápida'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <TabsList className="grid grid-cols-6 w-full">
                {(Object.keys(KIND_META) as Kind[]).map(k => {
                  const Icon = KIND_META[k].icon;
                  return (
                    <TabsTrigger key={k} value={k} className="text-xs">
                      <Icon className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden sm:inline">{KIND_META[k].label}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Saudação inicial" />
              </div>
              <div>
                <Label>Atalho</Label>
                <Input value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="ex: oi" />
              </div>
            </div>

            {kind === 'text' && (
              <div className="space-y-2">
                <Label>Texto *</Label>
                <Textarea ref={textRef} value={text} onChange={e => setText(e.target.value)} rows={5}
                  placeholder="Olá {{primeiro_nome}}, {{Saudacao_dia_tarde_noite}}! ..." />
                <VariableChips onInsert={(t) => insertAt(textRef, () => text, setText, t)} />
                {text && (
                  <div className="rounded-md border bg-muted/40 p-2 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground mb-1">
                      <Eye className="h-3 w-3" /> Pré-visualização
                    </div>
                    <p className="whitespace-pre-wrap text-foreground">{textPreview}</p>
                  </div>
                )}
              </div>
            )}

            {(kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'document') && (
              <div className="space-y-3">
                <Label>Arquivo *</Label>
                {!mediaUrl ? (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed rounded-lg py-8 flex flex-col items-center justify-center gap-2 hover:bg-muted/40 transition-colors">
                    {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
                    <span className="text-sm text-muted-foreground">
                      {uploading ? 'Enviando...' : `Clique para enviar ${KIND_META[kind].label.toLowerCase()}`}
                    </span>
                  </button>
                ) : (
                  <div className="border rounded-lg p-3 flex items-start gap-3">
                    {kind === 'image' && <img src={mediaUrl} alt="" className="h-24 w-24 rounded object-cover" />}
                    {kind === 'video' && <video src={mediaUrl} controls className="h-24 rounded bg-black" />}
                    {kind === 'audio' && <audio src={mediaUrl} controls className="flex-1" />}
                    {kind === 'document' && <Paperclip className="h-8 w-8 text-muted-foreground mt-1" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{mediaFilename}</p>
                      <p className="text-xs text-muted-foreground">{mediaMime}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => { setMediaUrl(null); setMediaPath(null); setMediaFilename(null); setMediaMime(null); setMediaSize(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <input ref={fileRef} type="file" hidden accept={KIND_META[kind].accept}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value=''; }} />

                <div>
                  <Label>Legenda (opcional)</Label>
                  <Textarea ref={captionRef} value={caption} onChange={e => setCaption(e.target.value)} rows={2}
                    placeholder="Texto que acompanha o anexo..." />
                  <div className="mt-2"><VariableChips onInsert={(t) => insertAt(captionRef, () => caption, setCaption, t)} /></div>
                  {caption && (
                    <div className="rounded-md border bg-muted/40 p-2 text-xs mt-2">
                      <div className="flex items-center gap-1 text-muted-foreground mb-1"><Eye className="h-3 w-3" /> Pré-visualização</div>
                      <p className="whitespace-pre-wrap text-foreground">{captionPreview}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {kind === 'link' && (
              <div className="space-y-3">
                <div>
                  <Label>URL *</Label>
                  <div className="flex gap-2">
                    <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." />
                    <Button type="button" variant="outline" onClick={fetchLinkPreview} disabled={fetchingPreview || !linkUrl.trim()}>
                      {fetchingPreview ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar preview'}
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Título</Label>
                    <Input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label>Imagem (URL)</Label>
                    <Input value={linkImage} onChange={e => setLinkImage(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea value={linkDescription} onChange={e => setLinkDescription(e.target.value)} rows={2} />
                </div>
                {(linkTitle || linkImage || linkDescription) && (
                  <div className="border rounded-lg p-3 flex gap-3">
                    {linkImage && <img src={linkImage} alt="" className="h-16 w-16 rounded object-cover" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{linkTitle || linkUrl}</p>
                      {linkDescription && <p className="text-xs text-muted-foreground line-clamp-2">{linkDescription}</p>}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Mensagem que acompanha o link (opcional)</Label>
                  <Textarea ref={textRef} value={text} onChange={e => setText(e.target.value)} rows={2}
                    placeholder="Olha esse link {{primeiro_nome}}!" />
                  <div className="mt-2"><VariableChips onInsert={(t) => insertAt(textRef, () => text, setText, t)} /></div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="cursor-pointer">Ativa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isCreating || isUpdating || uploading}>
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir mensagem rápida?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}