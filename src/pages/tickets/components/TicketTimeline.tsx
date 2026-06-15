import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  StickyNote, CircleDot, ArrowRightLeft, Flag, UserCheck, Reply,
  Star as StarIcon, Pencil, X, Check, Trash2,
} from 'lucide-react';
import type { TicketMessage, TicketAttachment } from '../types';

function getAttachments(m: TicketMessage): TicketAttachment[] {
  const raw = m.attachments;
  if (Array.isArray(raw)) return raw as TicketAttachment[];
  return [];
}

function eventIcon(m: TicketMessage) {
  if (m.kind === 'public') return Reply;
  if (m.kind === 'internal') return StickyNote;
  switch (m.event_type) {
    case 'created': return CircleDot;
    case 'status_change': return ArrowRightLeft;
    case 'assigned': return UserCheck;
    case 'csat': return StarIcon;
    default: return Flag;
  }
}

export interface TimelineEditState {
  editingId: string | null;
  editDraft: string;
  setEditingId: (id: string | null) => void;
  setEditDraft: (s: string) => void;
  canEditMessage: (m: TicketMessage) => boolean;
  onSaveEdit: (m: TicketMessage) => void;
  onDelete: (m: TicketMessage) => void;
  saving: boolean;
}

export function TicketTimeline({ messages, edit }: { messages: TicketMessage[]; edit?: TimelineEditState }) {
  const items = [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground py-8 text-center">Sem interações ainda.</p>;
  }
  return (
    <ol className="relative border-l border-border ml-3 space-y-4 py-2">
      {items.map((m) => {
        const Icon = eventIcon(m);
        const ts = format(new Date(m.created_at), 'dd/MM/yyyy HH:mm');
        const author = m.author_name || (m.author_role === 'agent' ? 'Suporte' : 'Solicitante');

        const bullet = (extra?: string) => (
          <span
            className={cn(
              'absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border bg-background',
              extra,
            )}
          >
            <Icon className="h-3 w-3 text-muted-foreground" />
          </span>
        );

        if (m.kind === 'event') {
          return (
            <li key={m.id} className="relative pl-6">
              {bullet('bg-muted/40')}
              <div className="text-xs text-muted-foreground leading-snug">
                <span className="text-foreground">{m.body || m.event_type || 'Evento'}</span>
                <span className="mx-1">·</span>
                <span>{ts}</span>
                {m.author_name ? <span> · {m.author_name}</span> : null}
              </div>
            </li>
          );
        }

        const isInternal = m.kind === 'internal';
        const isEditing = edit?.editingId === m.id;
        const canEdit = edit?.canEditMessage(m) ?? false;
        return (
          <li key={m.id} className="relative pl-6">
            {bullet(isInternal ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/40' : 'bg-background')}
            <div
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                isInternal
                  ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/50'
                  : 'bg-card',
              )}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-medium">
                  {isInternal ? `Nota interna · ${author}` : `Resposta de ${author}`}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">{ts}</span>
                  {canEdit && !isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Editar"
                        onClick={() => {
                          edit?.setEditingId(m.id);
                          edit?.setEditDraft(m.body ?? '');
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        title="Excluir"
                        onClick={() => edit?.onDelete(m)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    value={edit?.editDraft ?? ''}
                    onChange={(e) => edit?.setEditDraft(e.target.value)}
                    className="min-h-[60px] text-sm"
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => edit?.setEditingId(null)}
                      disabled={edit?.saving}
                    >
                      <X className="h-3 w-3 mr-1" /> Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => edit?.onSaveEdit(m)}
                      disabled={edit?.saving || !edit?.editDraft.trim()}
                    >
                      <Check className="h-3 w-3 mr-1" /> Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {m.body ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.body}</p>
                  ) : null}
                  {getAttachments(m).map((a, idx) => {
                    const isImage = a.type === 'image' || (a.mimetype || '').startsWith('image/');
                    if (isImage) {
                      return (
                        <a
                          key={idx}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block mt-2"
                        >
                          <img
                            src={a.url}
                            alt={a.file_name || 'anexo'}
                            className="max-h-64 rounded-md border cursor-zoom-in"
                          />
                        </a>
                      );
                    }
                    return (
                      <a
                        key={idx}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs underline text-primary"
                      >
                        {a.file_name || a.url}
                      </a>
                    );
                  })}
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}