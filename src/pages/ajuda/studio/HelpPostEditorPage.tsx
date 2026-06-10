import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, ImagePlus, Loader2, Save, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  useHelpPostById, useHelpCategories, useSaveHelpPost, uploadHelpMedia, slugifyHelpTitle,
} from '@/hooks/useHelpCenter';
import { HelpRichTextEditor } from './components/HelpRichTextEditor';

export default function HelpPostEditorPage() {
  const { id } = useParams();
  const isNew = !id || id === 'novo';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: existing, isLoading } = useHelpPostById(isNew ? undefined : id);
  const { data: categories = [] } = useHelpCategories(true);
  const save = useSaveHelpPost();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [categoryId, setCategoryId] = useState<string>('none');
  const [tags, setTags] = useState('');
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const [html, setHtml] = useState('');
  const [json, setJson] = useState<any>(null);
  const [postId, setPostId] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(isNew);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSummary(existing.summary || '');
      setCategoryId(existing.category_id || 'none');
      setTags((existing.tags || []).join(', '));
      setCoverUrl(existing.cover_image_url);
      setHtml(existing.content_html || '');
      setJson(existing.content || null);
      setPostId(existing.id);
      setEditorReady(true);
    }
  }, [existing]);

  const handleCoverUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande (máx. 10MB)');
      return;
    }
    setCoverUploading(true);
    try {
      const url = await uploadHelpMedia(file);
      setCoverUrl(url);
    } catch (e: any) {
      toast.error(e.message || 'Falha no upload da capa');
    } finally {
      setCoverUploading(false);
    }
  };

  const handleSave = async (status: 'draft' | 'published') => {
    if (!title.trim()) {
      toast.error('Informe o título do post');
      return;
    }
    try {
      const saved = await save.mutateAsync({
        id: postId || undefined,
        title: title.trim(),
        slug: existing?.slug || slugifyHelpTitle(title),
        summary: summary.trim() || null,
        category_id: categoryId === 'none' ? null : categoryId,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        cover_image_url: coverUrl,
        content: json || {},
        content_html: html,
        status,
        author_id: user ? String(user.id) : null,
        author_name: user?.name || null,
      } as any);
      setPostId(saved.id);
      toast.success(status === 'published' ? 'Post publicado!' : 'Rascunho salvo');
      if (status === 'published') navigate('/ajuda/studio');
    } catch {
      /* erro já tratado no hook */
    }
  };

  if (!isNew && isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate('/ajuda/studio')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{isNew && !postId ? 'Novo post' : 'Editar post'}</h1>
          {existing?.status === 'published' && <Badge className="mt-1">Publicado</Badge>}
          {existing?.status === 'draft' && <Badge variant="secondary" className="mt-1">Rascunho</Badge>}
        </div>
        <Button variant="outline" disabled={save.isPending} onClick={() => handleSave('draft')}>
          <Save className="h-4 w-4 mr-1" /> Salvar rascunho
        </Button>
        <Button disabled={save.isPending} onClick={() => handleSave('published')}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          Publicar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div>
            <Label>Título</Label>
            <Input className="text-lg font-medium" placeholder="Título do post" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Resumo (aparece nos cards)</Label>
            <Textarea rows={2} placeholder="Breve descrição do conteúdo…" value={summary} onChange={e => setSummary(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Conteúdo</Label>
            {editorReady && (
              <HelpRichTextEditor
                initialHtml={html}
                onChange={(h, j) => { setHtml(h); setJson(j); }}
              />
            )}
          </div>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label>Imagem de capa</Label>
              <button
                type="button"
                className="w-full aspect-video rounded-lg border-2 border-dashed bg-muted/40 flex items-center justify-center overflow-hidden hover:bg-muted transition"
                onClick={() => coverInputRef.current?.click()}
              >
                {coverUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : coverUrl ? (
                  <img src={coverUrl} alt="Capa" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-muted-foreground text-sm">
                    <ImagePlus className="h-6 w-6" /> Enviar capa
                  </span>
                )}
              </button>
              {coverUrl && (
                <Button variant="outline" size="sm" className="w-full" onClick={() => setCoverUrl(null)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Remover capa
                </Button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverUpload(f);
                  e.target.value = '';
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div>
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tags (separadas por vírgula)</Label>
                <Input placeholder="primeiros passos, chat, crm…" value={tags} onChange={e => setTags(e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}