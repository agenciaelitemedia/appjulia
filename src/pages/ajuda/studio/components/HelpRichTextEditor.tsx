import { useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import ImageExt from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { Node } from '@tiptap/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight, Link2, ImagePlus,
  Video as VideoIcon, Youtube as YoutubeIcon, Undo2, Redo2, Palette, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadHelpMedia } from '@/hooks/useHelpCenter';
import { toast } from 'sonner';

/** Nó de vídeo (arquivos enviados para o storage) */
const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: 'video' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['video', { ...HTMLAttributes, controls: 'true', class: 'help-video w-full rounded-lg my-4' }];
  },
});

const COLORS = ['#111827', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#2563eb', '#7c3aed', '#db2777'];

interface HelpRichTextEditorProps {
  initialHtml?: string;
  onChange: (html: string, json: any) => void;
  className?: string;
}

function ToolbarBtn({ active, onClick, title, children, disabled }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode; disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn('h-8 w-8', active && 'bg-accent text-accent-foreground')}
    >
      {children}
    </Button>
  );
}

export function HelpRichTextEditor({ initialHtml, onChange, className }: HelpRichTextEditorProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false },
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      ImageExt.configure({ HTMLAttributes: { class: 'rounded-lg my-4 max-w-full' } }),
      Youtube.configure({ width: 640, height: 360, HTMLAttributes: { class: 'rounded-lg my-4 w-full aspect-video h-auto' } }),
      Placeholder.configure({ placeholder: 'Escreva o conteúdo do post aqui…' }),
      VideoNode,
    ],
    content: initialHtml || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[360px] px-4 py-3',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML(), editor.getJSON());
    },
  });

  const handleUpload = useCallback(async (file: File, kind: 'image' | 'video') => {
    if (!editor) return;
    const maxMb = kind === 'video' ? 100 : 10;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande (máx. ${maxMb}MB)`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadHelpMedia(file);
      if (kind === 'image') {
        editor.chain().focus().setImage({ src: url }).run();
      } else {
        editor.chain().focus().insertContent({ type: 'video', attrs: { src: url } }).run();
      }
      toast.success(kind === 'image' ? 'Imagem inserida' : 'Vídeo inserido');
    } catch (e: any) {
      toast.error(e.message || 'Falha no upload');
    } finally {
      setUploading(false);
    }
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn('border rounded-lg bg-background overflow-hidden', className)}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/40 sticky top-0 z-10">
        <ToolbarBtn title="Desfazer" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Refazer" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarBtn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolbarBtn title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Tachado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarBtn>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Cor do texto">
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2">
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className="h-6 w-6 rounded-full border"
                  style={{ backgroundColor: c }}
                  onClick={() => editor.chain().focus().setColor(c).run()}
                />
              ))}
              <button
                type="button"
                className="h-6 px-1 text-xs border rounded"
                onClick={() => editor.chain().focus().unsetColor().run()}
              >
                Auto
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolbarBtn title="Título 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Título 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Título 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolbarBtn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolbarBtn title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarBtn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <ToolbarBtn title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarBtn>
        <ToolbarBtn title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarBtn>
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={cn('h-8 w-8', editor.isActive('link') && 'bg-accent')} title="Link">
              <Link2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2 space-y-2">
            <Input placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} />
            <div className="flex gap-2">
              <Button type="button" size="sm" onClick={() => {
                if (linkUrl.trim()) editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl.trim() }).run();
                setLinkUrl('');
              }}>Aplicar</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => editor.chain().focus().unsetLink().run()}>Remover</Button>
            </div>
          </PopoverContent>
        </Popover>
        <ToolbarBtn title="Inserir imagem (upload)" disabled={uploading} onClick={() => imageInputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </ToolbarBtn>
        <ToolbarBtn title="Inserir vídeo (upload)" disabled={uploading} onClick={() => videoInputRef.current?.click()}>
          <VideoIcon className="h-4 w-4" />
        </ToolbarBtn>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="Embed do YouTube">
              <YoutubeIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2 space-y-2">
            <Input placeholder="Cole o link do YouTube…" value={ytUrl} onChange={e => setYtUrl(e.target.value)} />
            <Button type="button" size="sm" onClick={() => {
              if (ytUrl.trim()) {
                editor.commands.setYoutubeVideo({ src: ytUrl.trim() });
                setYtUrl('');
              }
            }}>Inserir vídeo</Button>
          </PopoverContent>
        </Popover>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f, 'image');
          e.target.value = '';
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleUpload(f, 'video');
          e.target.value = '';
        }}
      />
    </div>
  );
}