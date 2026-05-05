import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Kanban, ChevronRight, MessageSquare, Scale, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import type { ChatContact } from '@/types/chat';
import { useQueueAgentLink } from '@/hooks/useQueueAgentLink';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';

interface Board {
  id: string;
  name: string;
  cod_agent: string;
  color: string;
  icon: string;
}

interface Pipeline {
  id: string;
  name: string;
  board_id: string;
  position: number;
  color: string;
}

interface CreateCrmCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ChatContact;
  codAgent?: string | null;
  queueId?: string | null;
  conversationId?: string | null;
}

export function CreateCrmCardSheet({ open, onOpenChange, contact, codAgent, queueId, conversationId }: CreateCrmCardSheetProps) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const queryClient = useQueryClient();

  // ---- Resolve effective cod_agent (prop → queue → user's first agent) ----
  const queueLink = useQueueAgentLink(!codAgent && open ? queueId ?? null : null);
  const myAgents = useMyAgents();

  const effectiveCodAgent = useMemo<string | null>(() => {
    if (codAgent) return String(codAgent);
    if (queueLink.data?.codAgent) return String(queueLink.data.codAgent);
    const first = myAgents.data?.myAgents?.[0]?.cod_agent;
    if (first) return String(first);
    return null;
  }, [codAgent, queueLink.data?.codAgent, myAgents.data?.myAgents]);

  const agentSource: 'conversation' | 'queue' | 'user' | 'none' = codAgent
    ? 'conversation'
    : queueLink.data?.codAgent
      ? 'queue'
      : myAgents.data?.myAgents?.[0]?.cod_agent
        ? 'user'
        : 'none';

  const agentResolving = !codAgent && (queueLink.isLoading || myAgents.isLoading);

  const [boards, setBoards] = useState<Board[]>([]);
  const [pipelinesByBoard, setPipelinesByBoard] = useState<Record<string, Pipeline[]>>({});
  const [expandedBoard, setExpandedBoard] = useState<string>('');
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');

  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [description, setDescription] = useState('');
  const [linkJulia, setLinkJulia] = useState(true);

  const [loadingBoards, setLoadingBoards] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- Detect Julia card ----
  const normalizedPhone = useMemo(
    () => (contact?.phone || '').replace(/\D/g, ''),
    [contact?.phone]
  );

  const juliaCard = useQuery({
    queryKey: ['julia-card-lookup', normalizedPhone, effectiveCodAgent],
    queryFn: async () => {
      if (!normalizedPhone || !effectiveCodAgent) return null;
      const { getBrPhoneVariants } = await import('@/lib/phoneVariants');
      const phoneVariants = getBrPhoneVariants(normalizedPhone);
      const rows = await externalDb.raw<{
        id: number;
        contact_name: string | null;
        stage_id: number;
        stage_name: string | null;
        stage_color: string | null;
      }>({
        query: `
          SELECT c.id, c.contact_name, c.stage_id, s.name as stage_name, s.color as stage_color
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON c.stage_id = s.id
          WHERE c.whatsapp_number = ANY($1::varchar[]) AND c.cod_agent = $2
          ORDER BY c.updated_at DESC NULLS LAST
          LIMIT 1
        `,
        params: [phoneVariants, effectiveCodAgent],
      });
      return rows[0] ?? null;
    },
    enabled: open && !!normalizedPhone && !!effectiveCodAgent,
    staleTime: 30_000,
  });

  // ---- Reset on open ----
  useEffect(() => {
    if (!open) return;
    setTitle(contact.name || contact.phone || 'Novo card');
    setValue('');
    setPriority('medium');
    setDescription(`Card criado a partir do chat (${contact.phone || contact.name}).`);
    setSelectedBoard('');
    setSelectedPipeline('');
    setExpandedBoard('');
    void loadBoards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadBoards = async () => {
    if (!clientId) return;
    setLoadingBoards(true);
    try {
      const { data, error } = await supabase
        .from('crm_boards')
        .select('id, name, cod_agent, color, icon')
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('position');
      if (error) throw error;
      setBoards(data || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar quadros');
    } finally {
      setLoadingBoards(false);
    }
  };

  const loadPipelines = async (boardId: string): Promise<Pipeline[]> => {
    if (pipelinesByBoard[boardId]) return pipelinesByBoard[boardId];
    try {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('id, name, board_id, position, color')
        .eq('board_id', boardId)
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      const list = (data || []) as Pipeline[];
      setPipelinesByBoard((prev) => ({ ...prev, [boardId]: list }));
      return list;
    } catch (err) {
      console.error(err);
      return [];
    }
  };

  const handleSelectBoard = async (boardId: string) => {
    // Toggle expansion
    const next = expandedBoard === boardId ? '' : boardId;
    setExpandedBoard(next);
    if (!next) {
      setSelectedBoard('');
      setSelectedPipeline('');
      return;
    }
    const list = await loadPipelines(boardId);
    const first = list[0];
    setSelectedBoard(boardId);
    setSelectedPipeline(first?.id ?? '');
  };

  const handleCreate = async () => {
    if (!selectedBoard || !selectedPipeline) {
      toast.error('Selecione um quadro e uma etapa');
      return;
    }
    if (!effectiveCodAgent) {
      toast.error('Nenhum agente disponível na sua conta');
      return;
    }
    setSaving(true);
    try {
      const links: Record<string, unknown> = {
        chat: {
          conversation_id: conversationId ?? null,
          contact_phone: contact.phone ?? null,
          contact_name: contact.name ?? null,
        },
      };
      if (linkJulia && juliaCard.data) {
        links.julia = {
          card_id: juliaCard.data.id,
          whatsapp_number: normalizedPhone,
          cod_agent: effectiveCodAgent,
          stage_id: juliaCard.data.stage_id,
          stage_name: juliaCard.data.stage_name,
        };
      }

      const { error } = await supabase.from('crm_deals').insert([{
        board_id: selectedBoard,
        pipeline_id: selectedPipeline,
        client_id: clientId,
        cod_agent: effectiveCodAgent,
        title: title.trim() || contact.name || 'Novo card',
        description,
        contact_name: contact.name,
        contact_phone: contact.phone,
        priority,
        value: value ? Number(value.replace(',', '.')) : 0,
        custom_fields: { source: 'chat', links } as any,
      }]);
      if (error) throw error;

      // Best-effort: registrar vínculo em chat_crm_links
      if (conversationId) {
        try {
          await supabase.from('chat_crm_links').insert({
            client_id: clientId,
            cod_agent: effectiveCodAgent,
            conversation_id: conversationId,
            external_system: 'crm_builder',
            external_id: selectedBoard,
            metadata: { pipeline_id: selectedPipeline },
          } as any);
        } catch (e) {
          console.warn('chat_crm_links insert falhou', e);
        }
      }

      toast.success('Card criado no CRM');
      // Invalida o link do CRM no header do chat para refletir a cor de vínculo imediatamente
      await queryClient.invalidateQueries({ queryKey: ['chat-deal-link', conversationId, clientId] });
      // Invalida o set de conversas vinculadas para que a lista de conversas atualize o badge CRM
      await queryClient.invalidateQueries({ queryKey: ['crm-builder-linked-conversations', clientId] });
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar card');
    } finally {
      setSaving(false);
    }
  };

  const stageSelected = !!selectedPipeline;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Kanban className="h-5 w-5 text-primary" />
            Criar Card no CRM
          </SheetTitle>
          <SheetDescription>
            {contact.name || 'Contato'} · {contact.phone || 'sem telefone'}
          </SheetDescription>
          <div className="pt-2">
            {agentResolving ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Resolvendo agente...
              </Badge>
            ) : effectiveCodAgent ? (
              <Badge variant="outline" className="text-[10px]">
                Agente: #{effectiveCodAgent}
                {agentSource === 'queue' && ' (via fila)'}
                {agentSource === 'user' && ' (seu agente)'}
                {agentSource === 'conversation' && ' (conversa)'}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                Nenhum agente disponível
              </Badge>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-5">
            {/* Step 1 — Boards list */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">1. Escolha o quadro</Label>
                {selectedPipeline && (
                  <Badge variant="outline" className="text-[10px]">
                    <Check className="h-3 w-3 mr-1" /> Etapa selecionada
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                O card sempre será criado na primeira etapa do quadro.
              </p>

              {loadingBoards ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : boards.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">Nenhum quadro encontrado. Crie um em CRM Builder.</p>
              ) : (
                <div className="space-y-2">
                  {boards.map((b) => {
                    const isExpanded = expandedBoard === b.id;
                    const pipelines = pipelinesByBoard[b.id] || [];
                    const firstStage = pipelines[0];
                    return (
                      <div key={b.id} className="border rounded-lg overflow-hidden bg-card">
                        <button
                          type="button"
                          onClick={() => handleSelectBoard(b.id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors',
                            selectedBoard === b.id && 'bg-primary/5'
                          )}
                        >
                          <div
                            className="h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${b.color}20`, color: b.color }}
                          >
                            <Kanban className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{b.name}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {pipelines.length > 0 ? `${pipelines.length} etapa(s)` : 'Clique para selecionar'}
                            </div>
                          </div>
                          <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', isExpanded && 'rotate-90')} />
                        </button>

                        {isExpanded && (
                          <div className="border-t bg-muted/20 p-3">
                            {pipelines.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Carregando etapas...</div>
                            ) : firstStage ? (
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-muted-foreground">Entrará em:</span>
                                <span
                                  className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: firstStage.color }}
                                />
                                <span className="font-medium">{firstStage.name}</span>
                                <Check className="h-3.5 w-3.5 text-primary ml-auto" />
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">
                                Este quadro não possui etapas ativas.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 2 — Details (only after stage selected) */}
            {stageSelected && (
              <div className="space-y-4 pt-2 border-t">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">2. Detalhes do card</Label>

                <div className="space-y-1.5">
                  <Label htmlFor="card-title" className="text-xs">Título</Label>
                  <Input id="card-title" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="card-value" className="text-xs">Valor (R$)</Label>
                    <Input id="card-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Prioridade</Label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="card-desc" className="text-xs">Descrição</Label>
                  <Textarea id="card-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>

                {/* Vínculos */}
                <div className="space-y-2 pt-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Vínculos</Label>

                  <div className="flex items-center gap-2 p-3 rounded-lg border bg-blue-500/5 border-blue-500/20">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">Conversa do chat</div>
                      <div className="text-[11px] text-muted-foreground">
                        Vínculo automático com a conversa atual
                      </div>
                    </div>
                    <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30 text-[10px]">Ativo</Badge>
                  </div>

                  {juliaCard.isLoading && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Procurando card no CRM da Julia...
                    </div>
                  )}

                  {juliaCard.data && (
                    <div className="flex items-center gap-2 p-3 rounded-lg border bg-purple-500/5 border-purple-500/20">
                      <Scale className="h-4 w-4 text-purple-600" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">Lead da Julia · #{juliaCard.data.id}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {juliaCard.data.stage_name || 'Sem etapa'}
                        </div>
                      </div>
                      <Switch checked={linkJulia} onCheckedChange={setLinkJulia} />
                    </div>
                  )}

                  {!juliaCard.isLoading && !juliaCard.data && (
                    <div className="text-[11px] text-muted-foreground px-1">
                      Nenhum card da Julia encontrado para este contato.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="p-4 border-t gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1">
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !stageSelected || !effectiveCodAgent || agentResolving} className="flex-1">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar Card
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}