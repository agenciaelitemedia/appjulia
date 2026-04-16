import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const SHORTCUTS: Array<{ keys: string[]; label: string }> = [
  { keys: ['j'], label: 'Próxima conversa' },
  { keys: ['k'], label: 'Conversa anterior' },
  { keys: ['e'], label: 'Marcar como resolvida' },
  { keys: ['#'], label: 'Transferir conversa' },
  { keys: ['/'], label: 'Buscar mensagens' },
  { keys: ['z'], label: 'Adiar (snooze)' },
  { keys: ['Esc'], label: 'Fechar conversa' },
  { keys: ['?'], label: 'Mostrar atalhos' },
];

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Atalhos do teclado
          </DialogTitle>
          <DialogDescription>
            Acelere seu atendimento com atalhos estilo Linear/Superhuman.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded">
              <span className="text-sm">{s.label}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 text-xs font-mono bg-muted border border-border rounded shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          Atalhos são desativados ao digitar em campos de texto.
        </p>
      </DialogContent>
    </Dialog>
  );
}
