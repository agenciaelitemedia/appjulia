import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Phone, Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PhoneCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  whatsappNumber: string;
  contactName: string;
  codAgent: string;
}

export function PhoneCallDialog({ open, onOpenChange, whatsappNumber, contactName, codAgent }: PhoneCallDialogProps) {
  const [selectedExtension, setSelectedExtension] = useState('');

  // Fetch agent's active extensions
  const { data: extensions = [] } = useQuery({
    queryKey: ['my-extensions-for-call', codAgent],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*')
        .eq('cod_agent', codAgent)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!codAgent,
  });

  const dial = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('api4com-proxy', {
        body: { action: 'dial', codAgent, extension: selectedExtension, phone: whatsappNumber },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success(`Ligando para ${contactName}...`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-primary" />
            Ligar para {contactName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-center">
            <p className="text-2xl font-mono font-bold tracking-wider">{whatsappNumber}</p>
            <p className="text-sm text-muted-foreground mt-1">{contactName}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Ramal de origem</label>
            <Select value={selectedExtension} onValueChange={setSelectedExtension}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o ramal..." />
              </SelectTrigger>
              <SelectContent>
                {extensions.map((ext: any) => (
                  <SelectItem key={ext.id} value={ext.extension_number}>
                    {ext.extension_number} {ext.label ? `(${ext.label})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {extensions.length === 0 && (
              <p className="text-xs text-destructive mt-1">Nenhum ramal ativo encontrado</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => dial.mutate()}
            disabled={!selectedExtension || dial.isPending}
            className="gap-2"
          >
            {dial.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
            {dial.isPending ? 'Discando...' : 'Ligar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
