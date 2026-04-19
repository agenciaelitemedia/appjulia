import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useMyAgents } from '@/pages/agente/meus-agentes/hooks/useMyAgents';
import { Loader2 } from 'lucide-react';

interface TransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransfer: (assignedTo: string, note?: string) => Promise<void>;
}

export function TransferDialog({ open, onOpenChange, onTransfer }: TransferDialogProps) {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [note, setNote] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);

  const { data: agentsData } = useMyAgents();
  const allAgents = [
    ...(agentsData?.myAgents || []),
    ...(agentsData?.monitoredAgents || []),
  ];

  const handleTransfer = async () => {
    if (!selectedAgent) return;
    setIsTransferring(true);
    try {
      await onTransfer(selectedAgent, note || undefined);
      onOpenChange(false);
      setSelectedAgent('');
      setNote('');
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <DialogDescription>
            Selecione o agente/atendente para transferir esta conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Transferir para</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um agente..." />
              </SelectTrigger>
              <SelectContent>
                {allAgents.map(agent => {
                  const displayName = agent.client_name || agent.business_name || agent.cod_agent;
                  return (
                    <SelectItem key={agent.cod_agent} value={displayName}>
                      {displayName}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Nota de transferência (opcional)</Label>
            <Textarea
              placeholder="Motivo ou contexto da transferência..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleTransfer} disabled={!selectedAgent || isTransferring}>
            {isTransferring && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
