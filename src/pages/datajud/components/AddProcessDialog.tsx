import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye } from 'lucide-react';
import { validateProcessNumber } from '../types';
import { useMonitoredProcesses } from '../hooks/useMonitoredProcesses';

interface AddProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProcessNumber?: string;
  initialTribunal?: string;
}

export function AddProcessDialog({ open, onOpenChange, initialProcessNumber, initialTribunal }: AddProcessDialogProps) {
  const [processNumber, setProcessNumber] = useState(initialProcessNumber || '');
  const [name, setName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const { addProcess } = useMonitoredProcesses();

  const validation = processNumber ? validateProcessNumber(processNumber) : null;

  const handleSubmit = () => {
    if (!validation?.valid || !name.trim()) return;
    addProcess.mutate({
      process_number: validation.clean,
      process_number_formatted: validation.formatted,
      name: name.trim(),
      client_phone: clientPhone.replace(/\D/g, '') || undefined,
      tribunal: initialTribunal,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setProcessNumber('');
        setName('');
        setClientPhone('');
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Monitorar Processo
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Número do Processo *</Label>
            <Input
              value={processNumber}
              onChange={(e) => setProcessNumber(e.target.value)}
              placeholder="0001234-56.2024.8.26.0100"
            />
            {validation && !validation.valid && (
              <p className="text-xs text-destructive">{validation.error}</p>
            )}
            {validation?.valid && (
              <p className="text-xs text-muted-foreground">{validation.formatted}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Nome / Identificação *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: João Silva - Trabalhista"
            />
          </div>
          <div className="space-y-2">
            <Label>Telefone do Cliente (opcional)</Label>
            <Input
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="5534988860163"
            />
            <p className="text-xs text-muted-foreground">Receberá alertas de movimentação via WhatsApp</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSubmit}
            disabled={!validation?.valid || !name.trim() || addProcess.isPending}
          >
            {addProcess.isPending ? 'Adicionando...' : 'Monitorar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
