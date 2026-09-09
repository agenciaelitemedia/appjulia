import { FileText, Image as ImageIcon, Mic, Phone, ExternalLink, Video } from 'lucide-react';
import type { DspTemplateButton } from '../types';

interface TemplatePreviewProps {
  body: string;
  footer?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  fileName?: string | null;
  buttons?: DspTemplateButton[];
  /** Valores de exemplo para as variáveis. */
  sampleVars?: Record<string, string>;
}

const DEFAULT_SAMPLE: Record<string, string> = {
  nome: 'Maria Silva',
  primeiro_nome: 'Maria',
  telefone: '(11) 99999-9999',
};

function renderBody(text: string, sample: Record<string, string>): string {
  return String(text ?? '')
    .replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k) => sample[k] ?? `[${k}]`)
    .replace(/\{\s*([\w.]+)\s*\}/g, (_m, k) => sample[k] ?? `[${k}]`);
}

/** Formata *negrito*, _itálico_ e ~riscado~ do WhatsApp. */
function formatted(text: string) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g);
  return parts.map((p, i) => {
    if (/^\*[^*\n]+\*$/.test(p)) return <strong key={i}>{p.slice(1, -1)}</strong>;
    if (/^_[^_\n]+_$/.test(p)) return <em key={i}>{p.slice(1, -1)}</em>;
    if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
    return <span key={i}>{p}</span>;
  });
}

function MediaBlock({ mediaType, mediaUrl, fileName }: { mediaType?: string | null; mediaUrl?: string | null; fileName?: string | null }) {
  const type = mediaType || 'image';
  if (type === 'image' && mediaUrl) {
    return (
      <img
        src={mediaUrl}
        alt="Prévia da mídia do template"
        className="mb-1.5 max-h-40 w-full rounded-md object-cover"
        loading="lazy"
      />
    );
  }
  const Icon = type === 'video' ? Video : type === 'audio' ? Mic : type === 'document' ? FileText : ImageIcon;
  const label = type === 'video' ? 'Vídeo' : type === 'audio' ? 'Áudio' : type === 'document' ? (fileName || 'Documento') : 'Imagem';
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-md bg-background/60 px-2 py-3 text-xs text-muted-foreground">
      <Icon className="h-4 w-4" /> {label}
    </div>
  );
}

export function TemplatePreview({
  body, footer, mediaUrl, mediaType, fileName, buttons = [], sampleVars,
}: TemplatePreviewProps) {
  const sample = { ...DEFAULT_SAMPLE, ...(sampleVars ?? {}) };
  const text = renderBody(body, sample);

  return (
    <div className="rounded-xl border bg-muted/40 p-3">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Prévia</p>
      <div className="max-w-[300px] rounded-lg rounded-tl-none bg-primary/10 p-2 shadow-sm">
        {mediaUrl && <MediaBlock mediaType={mediaType} mediaUrl={mediaUrl} fileName={fileName} />}
        <div className="whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground">
          {text ? formatted(text) : <span className="text-muted-foreground">Sua mensagem aparece aqui…</span>}
        </div>
        {footer?.trim() && (
          <p className="mt-1 text-[11px] text-muted-foreground">{renderBody(footer, sample)}</p>
        )}
        <div className="mt-1 text-right text-[10px] text-muted-foreground">agora</div>
        {buttons.length > 0 && (
          <div className="mt-1.5 space-y-1 border-t border-border/60 pt-1.5">
            {buttons.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-center gap-1.5 rounded-md bg-background/80 py-1.5 text-[12px] font-medium text-primary"
              >
                {b.type === 'url' && <ExternalLink className="h-3 w-3" />}
                {b.type === 'phone' && <Phone className="h-3 w-3" />}
                {b.text || 'Botão'}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
