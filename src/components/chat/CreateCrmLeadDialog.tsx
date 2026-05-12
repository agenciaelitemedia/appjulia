import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';
import type { ChatContact } from '@/types/chat';
import { useAuth } from '@/contexts/AuthContext';

interface Board {
  id: string;
  name: string;
  cod_agent: string;
}

interface Pipeline {
  id: string;
  name: string;
  board_id: string;
  position: number;
}

interface CreateCrmLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ChatContact;
  codAgent?: string | null;
  conversationId?: string | null;
}

export function CreateCrmLeadDialog({ open, onOpenChange, contact, codAgent, conversationId }: CreateCrmLeadDialogProps) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : '';
  const [boards, setBoards] = useState<Board[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<string>('');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(contact.name || contact.phone || 'Novo lead');
    setValue('');
    setDescription(`Lead criado a partir do chat (${contact.phone || contact.name}).`);
    void loadBoards();
  }, [open]);

  const loadBoards = async () => {
    if (!clientId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_boards')
        .select('id, name, cod_agent')
        .eq('client_id', clientId)
        .eq('is_archived', false)
        .order('position');
      if (error) throw error;
      setBoards(data || []);
      if (data?.[0]) {
        setSelectedBoard(data[0].id);
        await loadPipelines(data[0].id);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar quadros do CRM');
    } finally {
      setLoading(false);
    }
  };

  const loadPipelines = async (boardId: string) => {
    try {
      const { data, error } = await supabase
        .from('crm_pipelines')
        .select('id, name, board_id, position')
        .eq('board_id', boardId)
        .eq('is_active', true)
        .order('position');
      if (error) throw error;
      setPipelines(data || []);
      if (data?.[0]) setSelectedPipeline(data[0].id);
    } catch (err) {
      console.error(err);
    }
  };

  const handleBoardChange = async (id: string) => {
    setSelectedBoard(id);
    await loadPipelines(id);
  };

  const handleCreate = async () => {
    if (!selectedBoard || !selectedPipeline || !codAgent) {
      toast.error('Selecione um quadro e uma fase');
      return;
    }
    setSaving(true);
    try {
      const { data: newDeal, error } = await supabase.from('crm_deals').insert({
        board_id: selectedBoard,
        pipeline_id: selectedPipeline,
        client_id: clientId,
        cod_agent: codAgent,
        title: title.trim() || contact.name,
        description,
        contact_name: contact.name,
        contact_phone: contact.phone,
        value: value ? Number(value.replace(',', '.')) : 0,
        custom_fields: { source: 'chat', conversation_id: conversationId ?? null },
        created_by: user?.name || null,
        updated_by: user?.name || null,
      }).select('id').single();
      if (error) throw error;

      try {
        await supabase.from('crm_deal_history').insert({
          deal_id: newDeal.id,
          action: 'created',
          to_pipeline_id: selectedPipeline,
          changed_by: user?.name || null,
          notes: 'Card criado a partir do chat',
          changes: { source: 'chat', conversation_id: conversationId ?? null },
        } as any);
      } catch (e) {
        console.warn('crm_deal_history insert falhou', e);
      }
      toast.success('Lead criado no CRM');
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Criar lead no CRM
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : boards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">Nenhum quadro encontrado para este agente. Crie um em CRM Builder.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label>Quadro</Label>
              <Select value={selectedBoard} onValueChange={handleBoardChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{boards.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fase inicial</Label>
              <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Valor estimado (R$)</Label>
              <Input value={value} onChange={e => setValue(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving || loading || boards.length === 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar lead
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
