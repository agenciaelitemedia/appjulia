import { memo, useMemo } from 'react';
import { differenceInHours, differenceInMinutes } from 'date-fns';
import {
  CheckCheck, Clock, Megaphone, Bot, User, Ticket, Kanban, Users,
  MessageCircle, MessagesSquare, Instagram, Send, Globe, Facebook, Mail, type LucideIcon,
} from 'lucide-react';


import {
  Avatar, AvatarFallback, AvatarImage, Badge, cn,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  getMessagePreview, evaluateSla, SlaBadge,
} from '../extend/ui';
import { PriorityBadge } from '@/components/chat/PriorityBadge';
import type { MvpChatRowData } from '../api/types';

function initials(name?: string | null) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Padrão de tempo relativo usado no /chat (Helena-style). */
function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const mins = differenceInMinutes(new Date(), date);
  if (mins < 1) return 'há pouco tempo';
  if (mins < 60) return `há ${mins} minuto${mins > 1 ? 's' : ''}`;
  const hrs = differenceInHours(new Date(), date);
  if (hrs < 24) return `há ${hrs} hora${hrs > 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
}

function toTitleCase(s: string) {
  return s.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Ícone do canal de origem exibido sobre a foto do perfil. */
function channelMeta(channel?: string | null): { Icon: LucideIcon; tone: string; label: string } {
  const c = (channel || '').toLowerCase();
  if (c.includes('insta')) return { Icon: Instagram, tone: 'bg-gradient-to-br from-fuchsia-500 to-amber-500 text-white', label: 'Instagram' };
  if (c.includes('telegram')) return { Icon: Send, tone: 'bg-sky-500 text-white', label: 'Telegram' };
  if (c.includes('web') || c.includes('site') || c.includes('chat')) return { Icon: Globe, tone: 'bg-slate-600 text-white', label: 'WebChat (site)' };
  if (c.includes('face') || c.includes('messenger')) return { Icon: Facebook, tone: 'bg-blue-600 text-white', label: 'Facebook' };
  if (c.includes('mail')) return { Icon: Mail, tone: 'bg-orange-500 text-white', label: 'E-mail' };
  return { Icon: MessageCircle, tone: 'bg-[#25D366] text-white', label: 'WhatsApp' };
}

/** Gradiente light do badge de fila de acordo com o canal. */
function queueToneByChannel(channel?: string | null): string {
  const c = (channel || '').toLowerCase();
  if (c.includes('insta')) return 'bg-gradient-to-r from-blue-400 to-cyan-300 text-blue-950';
  if (c.includes('telegram')) return 'bg-gradient-to-r from-sky-400 to-blue-300 text-sky-950';
  if (c.includes('web') || c.includes('site') || c.includes('chat')) return 'bg-gradient-to-r from-slate-400 to-gray-300 text-slate-950';
  if (c.includes('face') || c.includes('messenger')) return 'bg-gradient-to-r from-blue-500 to-indigo-400 text-blue-950';
  if (c.includes('mail')) return 'bg-gradient-to-r from-orange-400 to-amber-300 text-orange-950';
  return 'bg-gradient-to-r from-emerald-400 to-green-300 text-emerald-950';
}

/** Badge de largura fixa, texto truncado e tooltip detalhado. */
function FixedBadge({
  icon: Icon, label, width, tone, tooltip,
}: {
  icon?: LucideIcon;
  label: string;
  width: string;
  tone: string;
  tooltip: string;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex h-5 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-1.5 text-[10px] font-medium',
              width,
              tone,
            )}
          >
            {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden /> : null}
            <span className="truncate">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}




interface Props {
  row: MvpChatRowData;
  selected?: boolean;
  /** Cor da aba de origem — pinta o fundo do card de forma bem suave. */
  accent?: 'amber' | 'emerald' | 'none';
  /** Fila da conversa está desconectada (mesma regra do /chat). */
  disconnected?: boolean;
  onSelect?: (row: MvpChatRowData) => void;
}

export const MvpChatRow = memo(function MvpChatRow({
  row, selected, accent = 'none', disconnected = false, onSelect,
}: Props) {
  const preview = useMemo(
    () => getMessagePreview({ text: row.last_message_text, type: 'text' } as any) || 'Sem mensagens',
    [row.last_message_text],
  );

  const sla = useMemo(
    () => evaluateSla(
      {
        status: row.status,
        priority: row.priority || 'normal',
        opened_at: row.opened_at,
        first_response_at: row.first_response_at,
        resolved_at: row.resolved_at,
        closed_at: row.closed_at,
        last_customer_message_at: row.last_customer_message_at,
        last_message_from_me: row.last_message_from_me,
      },
      [],
    ),
    [row.status, row.priority, row.opened_at, row.first_response_at, row.resolved_at, row.closed_at, row.last_customer_message_at, row.last_message_from_me],
  );

  const campaignTitle = (row.campaign?.campaign_data as any)?.campaign_name
    || (row.campaign?.campaign_data as any)?.title
    || 'Meta Ads';

  /** Badge da Júlia: sem IA (cinza) / etapa ativa (verde) / etapa inativa (vermelho). */
  const juliaBadge = useMemo(() => {
    const hasAgent = !!(row.queue_cod_agent && String(row.queue_cod_agent).trim());
    if (!hasAgent) {
      return {
        label: 'Sem IA',
        tone: 'border-border bg-muted/60 text-muted-foreground',
        tooltip: 'Fila sem agente de IA vinculado — atendimento humano',
      };
    }
    const stage = row.julia_stage_name || 'Sem etapa';
    if (row.session_is_active === true) {
      return {
        label: stage,
        tone: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        tooltip: `Júlia ativa · Etapa do CRM da Júlia: ${stage}`,
      };
    }
    return {
      label: stage,
      tone: 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400',
      tooltip: `Júlia inativa (humano assumiu) · Etapa do CRM da Júlia: ${stage}`,
    };
  }, [row.queue_cod_agent, row.session_is_active, row.julia_stage_name]);

  const crmLabel = row.crm_pipeline_name
    ? (row.crm_board_name ? `${row.crm_board_name} - ${row.crm_pipeline_name}` : row.crm_pipeline_name)
    : 'Sem CRM';

  const showSla = row.status !== 'closed' && row.status !== 'resolved' && sla.status !== 'unknown';

  const channel = useMemo(() => channelMeta(row.channel_type ?? (row as any).channel), [row.channel_type, (row as any).channel]);




  return (
    <button
      type="button"
      onClick={() => onSelect?.(row)}
      className={cn(
        'w-full border-b-2 border-dotted border-foreground/30 p-3 text-left transition-colors',
        'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        accent === 'amber' && 'bg-amber-500/[0.06]',
        accent === 'emerald' && 'bg-emerald-500/[0.06]',
        accent === 'none' && 'bg-transparent',
        selected && 'bg-primary/10',
        disconnected && 'border-l-4 border-l-destructive/60 !bg-destructive/10 hover:!bg-destructive/15',
      )}
    >
      <div className="flex gap-3">
        <div className="relative shrink-0">
          <Avatar className="h-11 w-11">
            {row.avatar ? <AvatarImage src={row.avatar} alt={row.contact_name ?? 'Contato'} /> : null}
            <AvatarFallback className="text-xs font-semibold">
              {row.is_group ? <Users className="h-4 w-4" /> : initials(row.lead_full_name || row.contact_name)}
            </AvatarFallback>
          </Avatar>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-background',
                    channel.tone,
                  )}
                >
                  <channel.Icon className="h-2.5 w-2.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Canal: {channel.label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>


        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-sm font-semibold">
              {row.lead_full_name || row.contact_name || row.phone || 'Sem nome'}
            </span>
            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
              {formatRelativeTime(row.last_message_at || row.conversation_updated_at)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <p className="truncate text-xs text-muted-foreground">{preview}</p>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {row.unread_count > 0 && (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                  {row.unread_count > 99 ? '99+' : row.unread_count}
                </span>
              )}
              <span onClick={(e) => e.stopPropagation()} role="presentation">
                <PriorityBadge conversationId={row.conversation_id} currentPriority={row.priority} compact />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Badges — 3 linhas, iniciando abaixo do avatar */}
      <div className="mt-2.5 w-full space-y-1">
        {/* Linha 1 — fila / responsável / IA */}
        <div className="flex items-center gap-1">
          <FixedBadge
            label={row.queue_name ? toTitleCase(row.queue_name) : 'Sem fila'}
            width="w-[112px]"
            tone={row.queue_name
              ? cn('border-transparent font-bold', queueToneByChannel(row.channel_type ?? (row as any).channel))
              : 'border-border bg-muted/60 text-muted-foreground'}
            tooltip={
              row.queue_name
                ? `Fila: ${row.queue_name}${row.channel_type ? ` · canal ${row.channel_type}` : ''}`
                : 'Conversa sem fila vinculada'
            }

          />

          <FixedBadge
            icon={User}
            label={row.assigned_to || 'Sem responsável'}
            width="w-[112px]"
            tone={row.assigned_to
              ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
              : 'border-border bg-muted/60 text-muted-foreground'}
            tooltip={row.assigned_to ? `Responsável: ${row.assigned_to}` : 'Nenhum atendente atribuído'}
          />

          <FixedBadge
            icon={Bot}
            label={juliaBadge.label}
            width="w-[112px]"
            tone={juliaBadge.tone}
            tooltip={juliaBadge.tooltip}
          />
        </div>

        {/* Linha 2 — SLA / CRM / campanha */}
        <div className="flex items-center gap-1">
          <div className="w-[92px] shrink-0">
            {showSla ? (
              <SlaBadge evaluation={sla} compact className="w-full rounded-full border border-current/40" />
            ) : (
              <FixedBadge
                icon={Clock}
                label="—"
                width="w-full"
                tone="border-border bg-muted/60 text-muted-foreground"
                tooltip="Sem SLA em acompanhamento para esta conversa"
              />
            )}
          </div>

          <FixedBadge
            icon={Kanban}
            label={crmLabel}
            width="w-[150px]"
            tone={row.crm_pipeline_name
              ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'border-border bg-muted/60 text-muted-foreground'}
            tooltip={
              row.crm_pipeline_name
                ? `CRM: ${row.crm_board_name ?? '—'} · Etapa: ${row.crm_pipeline_name}`
                : 'Conversa sem card no CRM Builder'
            }
          />

          <FixedBadge
            icon={Megaphone}
            label={row.campaign ? String(campaignTitle) : '---'}
            width="w-[104px]"
            tone={row.campaign
              ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400'
              : 'border-border bg-muted/60 text-muted-foreground'}
            tooltip={row.campaign ? `Campanha (Meta Ads): ${campaignTitle}` : 'Lead sem campanha de anúncio'}
          />

          {(row.sibling_open_count ?? 0) > 0 && (
            <FixedBadge
              icon={MessagesSquare}
              label={`+${row.sibling_open_count}`}
              width="w-[52px]"
              tone="border-border bg-muted/60 text-muted-foreground"
              tooltip={`Este contato tem ${row.sibling_open_count} outra(s) conversa(s) aberta(s)`}
            />
          )}

          {row.active_ticket_id && (
            <FixedBadge
              icon={Ticket}
              label={`#${row.active_ticket_number ?? row.active_ticket_protocol ?? '—'}`}
              width="w-[62px]"
              tone="border-border bg-muted/60 text-muted-foreground"
              tooltip={`Ticket de suporte ${row.ticket_status ? `· ${row.ticket_status}` : ''} ${row.ticket_subject ?? ''}`.trim()}
            />
          )}

          {row.last_message_from_me && (
            <CheckCheck className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )}
        </div>

        {/* Linha 3 — etiquetas */}
        {row.tags?.length ? (
          <div className="flex flex-wrap items-center gap-1">
            {row.tags.map((t) => (
              <TooltipProvider key={t.id} delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="h-5 max-w-[48%] justify-center overflow-hidden rounded-full px-1.5 text-[10px]"
                      style={{ borderColor: t.color, color: t.color }}
                    >
                      <span className="truncate">{t.name}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Etiqueta: {t.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        ) : null}
      </div>


    </button>
  );
});
