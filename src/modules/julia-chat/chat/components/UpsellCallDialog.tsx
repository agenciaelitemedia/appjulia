import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PhoneCall, Phone } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: 'voip' | 'zap';
}

const CONTENT = {
  zap: {
    title: 'ZAP Call indisponível',
    body:
      'Para habilitar o ZAP Call — módulo de ligação pelo WhatsApp — entre em contato com o Comercial da Atende Julia para contratação.',
  },
  voip: {
    title: 'VOIP Call indisponível',
    body:
      'Para habilitar o VOIP Call — módulo de ligação via telefonia normal (celular / telefone fixo) — entre em contato com o Comercial da Atende Julia para contratação.',
  },
} as const;

export function UpsellCallDialog({ open, onOpenChange, product }: Props) {
  const { title, body } = CONTENT[product];
  const Icon = product === 'zap' ? PhoneCall : Phone;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm leading-relaxed">
            {body}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}