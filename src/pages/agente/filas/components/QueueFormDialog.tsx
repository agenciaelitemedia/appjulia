import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { Queue, QueueFormData, useQueueMutations } from '../hooks/useQueues';

interface QueueFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queue?: Queue | null;
}

const channelOptions = [
  { value: 'uazapi', label: 'UaZapi (WhatsApp não-oficial)' },
  { value: 'waba', label: 'API Oficial Meta (WABA)' },
  { value: 'webchat', label: 'WebChat' },
  { value: 'instagram', label: 'Instagram' },
];

export function QueueFormDialog({ open, onOpenChange, queue }: QueueFormDialogProps) {
  const { createQueue, updateQueue } = useQueueMutations();
  const isEditing = !!queue;

  const [name, setName] = useState('');
  const [channelType, setChannelType] = useState('uazapi');
  const [evoUrl, setEvoUrl] = useState('');
  const [evoApikey, setEvoApikey] = useState('');
  const [evoInstance, setEvoInstance] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [wabaToken, setWabaToken] = useState('');
  const [wabaNumberId, setWabaNumberId] = useState('');

  useEffect(() => {
    if (queue) {
      setName(queue.name);
      setChannelType(queue.channel_type);
      setEvoUrl(queue.evo_url || '');
      setEvoApikey(queue.evo_apikey || '');
      setEvoInstance(queue.evo_instance || '');
      setWabaId(queue.waba_id || '');
      setWabaToken(queue.waba_token || '');
      setWabaNumberId(queue.waba_number_id || '');
    } else {
      setName('');
      setChannelType('uazapi');
      setEvoUrl(''); setEvoApikey(''); setEvoInstance('');
      setWabaId(''); setWabaToken(''); setWabaNumberId('');
    }
  }, [queue, open]);

  const isPending = createQueue.isPending || updateQueue.isPending;

  const handleSubmit = () => {
    if (!name.trim()) return;

    const formData: QueueFormData = {
      name: name.trim(),
      channel_type: channelType,
      hub: channelType,
    };

    if (channelType === 'uazapi') {
      formData.evo_url = evoUrl || undefined;
      formData.evo_apikey = evoApikey || undefined;
      formData.evo_instance = evoInstance || undefined;
    } else if (channelType === 'waba') {
      formData.waba_id = wabaId || undefined;
      formData.waba_token = wabaToken || undefined;
      formData.waba_number_id = wabaNumberId || undefined;
    }

    if (isEditing) {
      updateQueue.mutate({ queue_id: queue.id, ...formData }, {
        onSuccess: () => onOpenChange(false),
      });
    } else {
      createQueue.mutate(formData, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Fila' : 'Nova Fila'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize as configurações da fila de atendimento.' : 'Configure uma nova fila de atendimento para receber mensagens.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Nome da Fila</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: WhatsApp Principal" />
          </div>

          <div>
            <Label>Canal</Label>
            <Select value={channelType} onValueChange={setChannelType} disabled={isEditing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {channelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {channelType === 'uazapi' && (
            <>
              <div>
                <Label>URL da API</Label>
                <Input value={evoUrl} onChange={(e) => setEvoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>API Key</Label>
                <Input value={evoApikey} onChange={(e) => setEvoApikey(e.target.value)} type="password" placeholder="Token de acesso" />
              </div>
              <div>
                <Label>Nome da Instância</Label>
                <Input value={evoInstance} onChange={(e) => setEvoInstance(e.target.value)} placeholder="minha-instancia" />
              </div>
            </>
          )}

          {channelType === 'waba' && (
            <>
              <div>
                <Label>WABA ID</Label>
                <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="ID da conta WABA" />
              </div>
              <div>
                <Label>Access Token</Label>
                <Input value={wabaToken} onChange={(e) => setWabaToken(e.target.value)} type="password" placeholder="Token permanente" />
              </div>
              <div>
                <Label>Phone Number ID</Label>
                <Input value={wabaNumberId} onChange={(e) => setWabaNumberId(e.target.value)} placeholder="ID do número" />
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEditing ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
