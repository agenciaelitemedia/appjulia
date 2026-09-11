import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, Send } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TemplateComponent {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ text?: string; type?: string }>;
}

interface WabaTemplate {
  id: string;
  name: string;
  language: string | null;
  category: string | null;
  status: string | null;
  components: TemplateComponent[] | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queueId: string | null;
  toPhone: string | null;
  onSent?: () => void;
}

function bodyOf(t: WabaTemplate): string {
  const comp = (t.components || []).find((c) => String(c.type).toUpperCase() === 'BODY');
  return comp?.text ?? '';
}

function headerOf(t: WabaTemplate): string {
  const comp = (t.components || []).find((c) => String(c.type).toUpperCase() === 'HEADER');
  return comp?.text ?? '';
}

function footerOf(t: WabaTemplate): string {
  const comp = (t.components || []).find((c) => String(c.type).toUpperCase() === 'FOOTER');
  return comp?.text ?? '';
}

function buttonsOf(t: WabaTemplate): string[] {
  const comp = (t.components || []).find((c) => String(c.type).toUpperCase() === 'BUTTONS');
  return (comp?.buttons || []).map((b) => b?.text || '').filter(Boolean);
}

/** Extrai os índices de variáveis ({{1}}, {{2}}...) presentes no texto. */
function varsOf(text: string): number[] {
  const found = new Set<number>();
  const re = /\{\{\s*(\d+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) found.add(Number(m[1]));
  return Array.from(found).sort((a, b) => a - b);
}

function fill(text: string, values: Record<number, string>): string {
  return text.replace(/\{\{\s*(\d+)\s*\}\}/g, (_all, n) => values[Number(n)] || `{{${n}}}`);
}

/**
 * Envia um modelo aprovado da API Oficial — único caminho válido para reabrir
 * uma conversa fora da janela de 24 horas da Meta.
 */
export function WabaTemplateSendDialog({ open, onOpenChange, queueId, toPhone, onSent }: Props) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);

  const { data: templates = [], isLoading } = useQuery<WabaTemplate[]>({
    queryKey: ['waba-templates-send', queueId],
    enabled: open && !!queueId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waba_templates')
        .select('id, name, language, category, status, components')
        .eq('queue_id', queueId as string)
        .order('name');
      if (error) throw error;
      return ((data || []) as WabaTemplate[]).filter(
        (t) => String(t.status || '').toUpperCase() === 'APPROVED',
      );
    },
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return templates;
    return templates.filter(
      (t) => t.name.toLowerCase().includes(term) || bodyOf(t).toLowerCase().includes(term),
    );
  }, [templates, search]);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const headerText = selected ? headerOf(selected) : '';
  const bodyText = selected ? bodyOf(selected) : '';
  const headerVars = varsOf(headerText);
  const bodyVars = varsOf(bodyText);

  const handleSelect = (t: WabaTemplate) => {
    setSelectedId(t.id);
    setValues({});
  };

  const handleSend = async () => {
    if (!selected || !queueId || !toPhone) return;
    const missing = [...headerVars, ...bodyVars].some((n) => !(values[n] || '').trim());
    if (missing) {
      toast.error('Preencha todas as variáveis do modelo');
      return;
    }
    setSending(true);
    try {
      const components: Array<Record<string, unknown>> = [];
      if (headerVars.length > 0) {
        components.push({
          type: 'header',
          parameters: headerVars.map((n) => ({ type: 'text', text: values[n] })),
        });
      }
      if (bodyVars.length > 0) {
        components.push({
          type: 'body',
          parameters: bodyVars.map((n) => ({ type: 'text', text: values[n] })),
        });
      }

      const previewText = [fill(headerText, values), fill(bodyText, values)]
        .filter(Boolean)
        .join('\n');

      const { data, error } = await supabase.functions.invoke('waba-send', {
        body: {
          action: 'send_template',
          queue_id: queueId,
          to: toPhone,
          template_name: selected.name,
          language: selected.language || 'pt_BR',
          components: components.length > 0 ? components : undefined,
          preview_text: previewText || `[modelo] ${selected.name}`,
          sender_name: user?.name || 'Atendente',
          source: 'chat_template_reopen',
        },
      });
      if (error) throw error;
      const errMsg = (data as any)?.error?.message || (data as any)?.error;
      if (errMsg) throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));

      toast.success('Modelo enviado. A conversa será reaberta quando o cliente responder.');
      onSent?.();
      onOpenChange(false);
    } catch (e) {
      toast.error('Não foi possível enviar o modelo', {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Enviar modelo aprovado</DialogTitle>
          <DialogDescription>
            Fora da janela de 24 horas, o WhatsApp oficial só aceita modelos aprovados. Escolha um
            modelo para reabrir a conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar modelo..."
                className="pl-8"
              />
            </div>

            <ScrollArea className="h-[320px] rounded-md border">
              {isLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhum modelo aprovado nesta fila. Crie e aprove um modelo em Modelos da API
                  Oficial.
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelect(t)}
                      className={cn(
                        'w-full text-left px-3 py-2 hover:bg-accent transition-colors',
                        selectedId === t.id && 'bg-accent',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{t.name}</span>
                        {t.category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t.category}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{bodyOf(t)}</p>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-3">
            {!selected ? (
              <p className="text-sm text-muted-foreground">Selecione um modelo para ver a prévia.</p>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm whitespace-pre-wrap">
                  {headerText && <p className="font-semibold">{fill(headerText, values)}</p>}
                  <p>{fill(bodyText, values)}</p>
                  {footerOf(selected) && (
                    <p className="text-xs text-muted-foreground">{footerOf(selected)}</p>
                  )}
                  {buttonsOf(selected).length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {buttonsOf(selected).map((b, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {b}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {[...headerVars.map((n) => ({ n, scope: 'Cabeçalho' })), ...bodyVars.map((n) => ({ n, scope: 'Corpo' }))].length > 0 && (
                  <div className="space-y-2">
                    {headerVars.map((n) => (
                      <div key={`h-${n}`} className="space-y-1">
                        <Label className="text-xs">Cabeçalho — variável {n}</Label>
                        <Input
                          value={values[n] || ''}
                          onChange={(e) => setValues((v) => ({ ...v, [n]: e.target.value }))}
                        />
                      </div>
                    ))}
                    {bodyVars.map((n) => (
                      <div key={`b-${n}`} className="space-y-1">
                        <Label className="text-xs">Corpo — variável {n}</Label>
                        <Input
                          value={values[n] || ''}
                          onChange={(e) => setValues((v) => ({ ...v, [n]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                <Button onClick={handleSend} disabled={sending || !toPhone} className="w-full gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar modelo
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
