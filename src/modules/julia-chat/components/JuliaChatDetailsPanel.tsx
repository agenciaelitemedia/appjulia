import { Info, Phone, Users, Kanban, Ticket, Megaphone, Bot, User } from 'lucide-react';
import { Badge, Separator, cn } from '../extend/ui';
import type { JuliaChatRowData } from '../api/types';

const STATUS_LABEL: Record<string, string> = {
  pending: 'Aguardando', open: 'Atendimento', resolved: 'Resolvida', closed: 'Fechada',
};

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="break-words text-xs">{value}</p>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function JuliaChatDetailsPanel({ row }: { row: JuliaChatRowData | null }) {
  if (!row) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
        <Info className="h-8 w-8 opacity-40" aria-hidden />
        <p className="text-xs">Selecione uma conversa para ver os detalhes.</p>
      </div>
    );
  }

  return (
    <div className="thin-scrollbar h-full space-y-4 overflow-y-auto p-3">
      <Section icon={Users} title="Contato">
        <Field label="Nome" value={row.contact_name || row.lead_full_name || 'Sem nome'} />
        <Field label="Telefone" value={row.phone} />
        <Field label="Tipo" value={row.is_group ? 'Grupo' : 'Individual'} />
        <Field label="Canal" value={row.channel_source || row.channel || row.channel_type} />
      </Section>

      <Separator />

      <Section icon={Phone} title="Atendimento">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[10px]">{STATUS_LABEL[row.status] ?? row.status}</Badge>
          {row.priority && <Badge variant="outline" className="text-[10px]">{row.priority}</Badge>}
          {row.session_is_active != null && (
            <Badge variant="outline" className="gap-1 text-[10px]">
              {row.session_is_active ? <Bot className="h-3 w-3" aria-hidden /> : <User className="h-3 w-3" aria-hidden />}
              {row.session_is_active ? 'Júlia ativa' : 'Humano'}
            </Badge>
          )}
          {row.unread_count > 0 && (
            <Badge className="text-[10px]">{row.unread_count} não lida(s)</Badge>
          )}
        </div>
        <Field label="Fila" value={row.queue_name} />
        <Field label="Responsável" value={row.assigned_to || 'Sem responsável'} />
        <Field label="Protocolo" value={row.protocol} />
        <Field
          label="SLA"
          value={
            row.sla_status
              ? `${row.sla_status}${row.sla_remaining_minutes != null ? ` · ${row.sla_remaining_minutes} min` : ''}`
              : null
          }
        />
      </Section>

      {(row.crm_board_name || row.julia_stage_name) && (
        <>
          <Separator />
          <Section icon={Kanban} title="CRM">
            <Field label="Quadro" value={row.crm_board_name} />
            <Field label="Etapa (Builder)" value={row.crm_pipeline_name} />
            <Field
              label="Etapa (CRM da Júlia)"
              value={
                row.julia_stage_name ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={cn('h-2 w-2 rounded-full bg-primary')}
                      style={row.julia_stage_color ? { backgroundColor: row.julia_stage_color } : undefined}
                      aria-hidden
                    />
                    {row.julia_stage_name}
                  </span>
                ) : null
              }
            />
          </Section>
        </>
      )}

      {row.active_ticket_id && (
        <>
          <Separator />
          <Section icon={Ticket} title="Ticket">
            <Field label="Número" value={row.active_ticket_protocol || row.active_ticket_number} />
            <Field label="Assunto" value={row.ticket_subject} />
            <Field label="Status" value={row.ticket_status} />
            <Field label="Prioridade" value={row.ticket_priority} />
          </Section>
        </>
      )}

      {row.campaign && (
        <>
          <Separator />
          <Section icon={Megaphone} title="Meta Ads">
            <Field label="Campanha" value={String(row.campaign.id)} />
            <Field label="Criada em" value={row.campaign.created_at} />
          </Section>
        </>
      )}

      {row.tags.length > 0 && (
        <>
          <Separator />
          <Section icon={Info} title="Etiquetas">
            <div className="flex flex-wrap gap-1.5">
              {row.tags.map((t) => (
                <Badge
                  key={t.id}
                  variant="outline"
                  className="text-[10px]"
                  style={{ borderColor: t.color, color: t.color }}
                >
                  {t.name}
                </Badge>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
