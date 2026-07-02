import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ExternalLink,
  ImageOff,
  Copy,
  Check,
  MessageSquareQuote,
  Instagram,
  Facebook,
  Globe,
} from 'lucide-react';
import type { ContactCampaignRow } from './hooks/useContactCampaigns';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Wrap a remote image URL through our edge proxy so Meta CDN's expiring
 *  signed URLs (oe=...) and referrer restrictions don't break the preview. */
function proxied(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (!SUPABASE_URL) return url;
  return `${SUPABASE_URL}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function asDataImage(value: unknown): string | undefined {
  const trimmed = asString(value);
  if (!trimmed) return undefined;
  if (/^data:image\//i.test(trimmed)) return trimmed;

  const base64 = trimmed
    .replace(/^data:[^;]+;base64,/i, '')
    .replace(/^base64,/i, '')
    .replace(/\s/g, '');

  if (/^\/9j\//.test(base64)) return `data:image/jpeg;base64,${base64}`;
  if (/^iVBORw0KGgo/.test(base64)) return `data:image/png;base64,${base64}`;
  if (/^R0lGOD/.test(base64)) return `data:image/gif;base64,${base64}`;
  if (/^UklGR/.test(base64)) return `data:image/webp;base64,${base64}`;

  // Alguns registros antigos salvam apenas o base64 bruto sem header/magic
  // preservado. Se for grande e contiver só caracteres base64, tenta JPEG.
  if (base64.length > 120 && /^[A-Za-z0-9+/=_-]+$/.test(base64)) {
    return `data:image/jpeg;base64,${base64.replace(/-/g, '+').replace(/_/g, '/')}`;
  }

  return undefined;
}

function isLikelyImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/') || url.startsWith('blob:')) return true;
  if (/\.(jpe?g|png|gif|webp|avif)(\?|#|$)/i.test(url)) return true;
  return /(fbcdn\.net|cdninstagram\.com|scontent\.|instagram\.f[a-z0-9-]+\.fna)/i.test(url);
}

function appendImageUrl(out: string[], value: unknown) {
  const url = asString(value);
  if (!url || !isLikelyImageUrl(url)) return;
  if (url.startsWith('data:image/') || url.startsWith('blob:')) {
    out.push(url);
    return;
  }
  // Tenta primeiro pelo proxy e depois direto no navegador. Em alguns links do
  // Meta o proxy é bloqueado, mas o <img> direto ainda funciona; em outros é o
  // inverso. Manter ambos evita cair prematuramente no placeholder.
  out.push(proxied(url) || url, url);
}

interface Props {
  row: ContactCampaignRow;
  /** Sobrescreve a "Frase do lead" (ex.: primeira mensagem real recebida). */
  greetingOverride?: string | null;
}

/**
 * Card de campanha exibido tanto na aba "Campanhas" do painel de detalhes
 * quanto no popup "Ver Ads" da lista de conversas. Reaproveita 100% do
 * layout — thumbnail em destaque, badge de plataforma, título/descrição,
 * bloco "Frase do lead", data e botões Acessar/copiar.
 */
export function ContactCampaignCard({ row, greetingOverride }: Props) {
  const cd = (row.campaign_data || {}) as Record<string, any>;
  const title = cd.title || 'Campanha sem título';
  const body = cd.body as string | undefined;
  const platform = (cd.sourceApp || 'outros').toString().toLowerCase();
  const sourceURL = cd.sourceURL as string | undefined;
  const rawThumbnail = cd.thumbnail;
  const rawMedia = cd.mediaURL ?? cd.mediaUrl ?? cd.media_url;
  const inlineThumbnail =
    asDataImage(cd.thumbnail) || asDataImage(cd.thumbnailBase64) || asDataImage(cd.imageBase64);
  const fallbackGreeting = cd.greetingMessageBody as string | undefined;
  const greeting = (greetingOverride && greetingOverride.trim()) || fallbackGreeting;

  // Cascata de fontes para o preview da imagem. Se o CDN do Meta rejeitar
  // (referrer/CORS), tenta a próxima; só cai em `ImageOff` quando todas
  // falharem.
  const imgCandidates = useMemo(() => {
    const candidates: string[] = [];
    if (inlineThumbnail) candidates.push(inlineThumbnail);

    appendImageUrl(candidates, cd.thumbnailURL);
    appendImageUrl(candidates, rawThumbnail);
    appendImageUrl(candidates, cd.thumbnail_url);
    appendImageUrl(candidates, cd.imageURL ?? cd.imageUrl ?? cd.image_url ?? cd.image);
    appendImageUrl(candidates, cd.picture ?? cd.pictureURL ?? cd.pictureUrl);
    appendImageUrl(candidates, rawMedia);

    return [...new Set(candidates)];
  }, [cd, inlineThumbnail, rawMedia, rawThumbnail]);
  const [imgIdx, setImgIdx] = useState(0);
  useEffect(() => {
    setImgIdx(0);
  }, [imgCandidates]);
  const currentSrc = imgCandidates[imgIdx];
  const handleImgError = () => {
    if (imgIdx < imgCandidates.length - 1) {
      setImgIdx(imgIdx + 1);
    } else {
      console.warn('[ContactCampaignCard] todas as fontes de imagem falharam', {
        campaignId: row.id,
        availableKeys: Object.keys(cd),
        imageFields: {
          thumbnailURL: cd.thumbnailURL,
          thumbnail: typeof rawThumbnail === 'string' ? rawThumbnail.slice(0, 120) : typeof rawThumbnail,
          mediaURL: rawMedia,
        },
      });
      setImgIdx(imgCandidates.length); // força fallback
    }
  };

  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!greeting) return;
    await navigator.clipboard.writeText(greeting);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const PlatformIcon =
    platform === 'instagram' ? Instagram : platform === 'facebook' ? Facebook : Globe;
  const platformBadgeCls =
    platform === 'instagram'
      ? 'bg-gradient-to-tr from-fuchsia-500 to-orange-400 text-white border-transparent'
      : platform === 'facebook'
        ? 'bg-blue-600 text-white border-transparent'
        : platform === 'google'
          ? 'bg-emerald-600 text-white border-transparent'
          : 'bg-muted text-muted-foreground border-border';

  const showImg = currentSrc && imgIdx < imgCandidates.length;

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="relative aspect-video bg-muted">
        {showImg ? (
          <img
            key={currentSrc}
            src={currentSrc}
            alt={title}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            loading="lazy"
            decoding="async"
            onError={handleImgError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageOff className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="absolute top-2 left-2">
          <span
            className={cn(
              'inline-flex h-7 w-7 items-center justify-center rounded-full border',
              platformBadgeCls,
            )}
          >
            <PlatformIcon className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <h3 className="font-semibold text-sm line-clamp-1" title={title}>
          {title}
        </h3>
        {body && <p className="text-xs text-muted-foreground line-clamp-3">{body}</p>}
        {greeting && (
          <div className="bg-muted/50 rounded-md p-2 space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquareQuote className="h-3 w-3" />
              <span>Frase do lead:</span>
            </div>
            <p className="text-xs italic line-clamp-3">"{greeting}"</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          Último lead:{' '}
          {format(new Date(row.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
        </p>
        <div className="flex gap-2 pt-1">
          {sourceURL && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <a href={sourceURL} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-1" />
                Acessar
              </a>
            </Button>
          )}
          {greeting && (
            <Button variant="ghost" size="sm" onClick={handleCopy} className="shrink-0">
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ContactCampaignCard;