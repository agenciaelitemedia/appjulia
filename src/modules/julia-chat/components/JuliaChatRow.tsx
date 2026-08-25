import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { differenceInHours, differenceInMinutes } from 'date-fns';
import {
  Clock, Megaphone, Bot, User, Ticket, Kanban, Users,
  MessageCircle, MessagesSquare, Instagram, Send, Globe, Facebook, Mail,
  UserPlus, UserCog, ArrowRightLeft, Undo2, ExternalLink, ChevronDown, ChevronUp,
  type LucideIcon,
} from 'lucide-react';


import {
  Avatar, AvatarFallback, AvatarImage, Badge, cn,
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
  getMessagePreview, evaluateSla, SlaBadge,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  Dialog, DialogContent, DialogHeader, DialogTitle,
  TransferDialog, ReturnToQueueDialog, ContactCampaignCard,
} from '../extend/ui';
import { useAuth } from '../extend/auth';
import { isOwnerUser } from '../extend/queues';
import { PriorityBadge } from '@/modules/julia-chat/chat/components/PriorityBadge';
import { JuliaBadgeMenu } from './JuliaBadgeMenu';
import { JuliaAssignDialog } from './JuliaAssignDialog';
import { useJuliaCrmTarget } from '../hooks/useJuliaCrmTarget';
import { juliaAssignConversation, juliaReturnToQueue } from '../api/juliaChatActions';
import type { JuliaChatRowData } from '../api/types';

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
              'inline-flex h-5 items-center justify-center gap-1 overflow-hidden rounded-full border px-1.5 text-[10px] font-medium',
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
  row: JuliaChatRowData;
  selected?: boolean;
  /** Cor da aba de origem — pinta o fundo do card de forma bem suave. */
  accent?: 'amber' | 'emerald' | 'none';
  /** Fila da conversa está desconectada (mesma regra do /chat). */
  disconnected?: boolean;
  /** Aba de origem — define as ações do badge de responsável. */
  tab?: 'pending' | 'open' | 'resolved_closed';
  onSelect?: (row: JuliaChatRowData) => void;
  /** Revalida o feed após uma ação no card. */
  onChanged?: () => void;
}

export const JuliaChatRow = memo(function JuliaChatRow({
  row, selected, accent = 'none', disconnected = false, tab = 'open', onSelect, onChanged,
}: Props) {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const isOwner = isAdmin || isOwnerUser(user);
  const currentUserName = (user as any)?.name ? String((user as any).name) : '';
  const clientId = (user as any)?.client_id ? String((user as any).client_id) : null;

  const [assignOpen, setAssignOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [badgesExpanded, setBadgesExpanded] = useState(false);
  const { resolve: resolveCrmTarget } = useJuliaCrmTarget();

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

  const hasJuliaAgent = !!(row.queue_cod_agent && String(row.queue_cod_agent).trim());

  /** Badge da Júlia: sem IA (cinza) / etapa ativa (verde) / etapa inativa (vermelho). */
  const juliaBadge = useMemo(() => {
    if (!hasJuliaAgent) {
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
  }, [hasJuliaAgent, row.session_is_active, row.julia_stage_name]);

  const crmLabel = row.crm_pipeline_name
    ? (row.crm_board_name ? `${row.crm_board_name} - ${row.crm_pipeline_name}` : row.crm_pipeline_name)
    : 'Sem CRM';

  const showSla = row.status !== 'closed' && row.status !== 'resolved' && sla.status !== 'unknown';

  const channel = useMemo(() => channelMeta(row.channel_type ?? (row as any).channel), [row.channel_type, (row as any).channel]);

  // ---------- Ações ----------
  const assign = async (assignedTo: string, assignedUserId: number | null, openIt: boolean) => {
    await juliaAssignConversation({
      conversationId: row.conversation_id,
      assignedTo,
      assignedUserId,
      actor: { name: currentUserName, id: (user as any)?.id ?? null },
      openConversation: openIt,
      currentStatus: row.status,
      contactPhone: row.phone,
      queueId: row.queue_id,
    });
    onChanged?.();
  };

  const handleAssume = async () => {
    if (!currentUserName) {
      toast.error('Usuário não identificado.');
      return;
    }
    try {
      await assign(currentUserName, (user as any)?.id ? Number((user as any).id) : null, true);
      toast.success('Conversa assumida');
    } catch (e: any) {
      toast.error(`Não foi possível assumir: ${e?.message || e}`);
    }
  };

  const handleAssignConfirm = async (assignedTo: string, assignedUserId: number | null) => {
    try {
      await assign(assignedTo, assignedUserId, true);
      toast.success(`Responsável definido: ${assignedTo}`);
    } catch (e: any) {
      toast.error(`Não foi possível definir: ${e?.message || e}`);
      throw e;
    }
  };

  const handleTransferConfirm = async (assignedTo: string, assignedUserId: number | null) => {
    try {
      await assign(assignedTo, assignedUserId, true);
      toast.success('Conversa transferida');
    } catch (e: any) {
      toast.error(`Não foi possível transferir: ${e?.message || e}`);
      throw e;
    }
  };

  const handleReturnConfirm = async (note?: string) => {
    try {
      await juliaReturnToQueue({
        conversationId: row.conversation_id,
        actor: { name: currentUserName, id: (user as any)?.id ?? null },
        removedAgent: row.assigned_to,
        removedUserId: row.assigned_user_id,
        note,
      });
      onChanged?.();
      toast.success('Conversa devolvida para a fila');
    } catch (e: any) {
      toast.error(`Não foi possível devolver: ${e?.message || e}`);
      throw e;
    }
  };

  const goJuliaCrm = () => {
    const phone = (row.phone || '').replace(/\D/g, '');
    navigate(phone ? `/crm/leads?whatsapp=${encodeURIComponent(phone)}` : '/crm/leads');
  };

  const goCrmBuilder = async () => {
    try {
      const target = await resolveCrmTarget({
        clientId,
        conversationId: row.conversation_id,
        contactId: row.contact_id,
      });
      if (!target?.boardId) {
        toast.error('Não foi possível localizar o painel do CRM vinculado.');
        return;
      }
      navigate(`/crm-builder/${target.boardId}${target.dealId ? `?deal=${target.dealId}` : ''}`);
    } catch (e: any) {
      toast.error(`Erro ao abrir o CRM: ${e?.message || e}`);
    }
  };

  return (
    <>
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

      {/* Badges — fila sempre visível; demais ocultos até expandir */}
      <div className="mt-2.5 w-full space-y-1">
        {/* Linha 1 — fila + toggle / responsável / IA (quando expandido) */}
        <div className="flex items-center gap-1">
          <FixedBadge
            icon={channel.Icon}
            label={row.queue_name ? toTitleCase(row.queue_name) : 'Sem fila'}
            width="flex-1 min-w-0"
            tone={row.queue_name
              ? cn('border-transparent font-bold', queueToneByChannel(row.channel_type ?? (row as any).channel))
              : 'border-border bg-muted/60 text-muted-foreground'}
            tooltip={
              row.queue_name
                ? `Fila: ${row.queue_name}${row.channel_type ? ` · canal ${row.channel_type}` : ''}`
                : 'Conversa sem fila vinculada'
            }
          />

          {!badgesExpanded ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setBadgesExpanded(true); }}
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                'border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-accent',
              )}
              title="Mostrar mais badges"
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          ) : (
            <>
              <JuliaBadgeMenu
                icon={User}
                label={row.assigned_to || 'Sem responsável'}
                width="flex-1 min-w-0"
                tone={row.assigned_to
                  ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400'
                  : 'border-border bg-muted/60 text-muted-foreground'}
                tooltip={row.assigned_to ? `Responsável: ${row.assigned_to}` : 'Nenhum atendente atribuído'}
              >
                <DropdownMenuLabel className="text-[11px]">Responsável</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tab === 'open' ? (
                  <>
                    {isOwner && (
                      <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Transferir
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setReturnOpen(true)}>
                      <Undo2 className="mr-2 h-4 w-4" /> Devolver para a fila
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onSelect={() => setAssignOpen(true)}>
                      <UserCog className="mr-2 h-4 w-4" /> Definir Responsável
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => { void handleAssume(); }}>
                      <UserPlus className="mr-2 h-4 w-4" /> Assumir Conversa
                    </DropdownMenuItem>
                  </>
                )}
              </JuliaBadgeMenu>

              <JuliaBadgeMenu
                icon={Bot}
                label={juliaBadge.label}
                width="w-[116px]"
                tone={juliaBadge.tone}
                tooltip={juliaBadge.tooltip}
              >
                {hasJuliaAgent ? (
                  <DropdownMenuItem onSelect={goJuliaCrm}>
                    <ExternalLink className="mr-2 h-4 w-4" /> Ir CRM Júlia
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>---</DropdownMenuItem>
                )}
              </JuliaBadgeMenu>
            </>
          )}
        </div>

        {/* Linha 2 — SLA / CRM / campanha / fechar + demais badges (somente expandido) */}
        {badgesExpanded && (
          <div className="flex items-center gap-0.5">
            <div className="w-[78px] shrink-0">
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

            <JuliaBadgeMenu
              icon={Kanban}
              label={crmLabel}
              width="w-[110px]"
              tone={row.crm_pipeline_name
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'border-border bg-muted/60 text-muted-foreground'}
              tooltip={
                row.crm_pipeline_name
                  ? `CRM: ${row.crm_board_name ?? '—'} · Etapa: ${row.crm_pipeline_name}`
                  : 'Conversa sem card no CRM Builder'
              }
            >
              {row.crm_pipeline_name ? (
                <DropdownMenuItem onSelect={() => { void goCrmBuilder(); }}>
                  <ExternalLink className="mr-2 h-4 w-4" /> Ir Painel do CRM
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>---</DropdownMenuItem>
              )}
            </JuliaBadgeMenu>

            <JuliaBadgeMenu
              icon={Megaphone}
              label={row.campaign ? String(campaignTitle) : '---'}
              width="w-[90px]"
              tone={row.campaign
                ? 'border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400'
                : 'border-border bg-muted/60 text-muted-foreground'}
              tooltip={row.campaign ? `Campanha (Meta Ads): ${campaignTitle}` : 'Lead sem campanha de anúncio'}
            >
              {row.campaign ? (
                <DropdownMenuItem onSelect={() => setCampaignOpen(true)}>
                  <Megaphone className="mr-2 h-4 w-4" /> Ver Campanha
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled>---</DropdownMenuItem>
              )}
            </JuliaBadgeMenu>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setBadgesExpanded(false); }}
              className={cn(
                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                'border-border bg-muted/60 text-muted-foreground transition-colors hover:bg-accent',
              )}
              title="Ocultar badges"
            >
              <ChevronUp className="h-3 w-3" />
            </button>

            {(row.sibling_open_count ?? 0) > 0 && (
              <FixedBadge
                icon={MessagesSquare}
                label={`+${row.sibling_open_count}`}
                width="w-[44px]"
                tone="border-border bg-muted/60 text-muted-foreground"
                tooltip={`Este contato tem ${row.sibling_open_count} outra(s) conversa(s) aberta(s)`}
              />
            )}

            {row.active_ticket_id && (
              <FixedBadge
                icon={Ticket}
                label={`#${row.active_ticket_number ?? row.active_ticket_protocol ?? '—'}`}
                width="w-[52px]"
                tone="border-border bg-muted/60 text-muted-foreground"
                tooltip={`Ticket de suporte ${row.ticket_status ? `· ${row.ticket_status}` : ''} ${row.ticket_subject ?? ''}`.trim()}
              />
            )}
          </div>
        )}

        {/* Linha 3 — etiquetas (sempre visíveis, não entram no expandir/recolher) */}
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

      {/* Diálogos das ações dos badges */}
      <JuliaAssignDialog open={assignOpen} onOpenChange={setAssignOpen} onConfirm={handleAssignConfirm} />
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} onTransfer={handleTransferConfirm} />
      <ReturnToQueueDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        onConfirm={handleReturnConfirm}
        currentAssignee={row.assigned_to ?? undefined}
      />
      {row.campaign && (
        <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Campanha de origem</DialogTitle>
            </DialogHeader>
            <ContactCampaignCard
              row={{
                id: row.campaign.id,
                created_at: row.campaign.created_at ?? new Date().toISOString(),
                campaign_data: row.campaign.campaign_data ?? null,
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});
