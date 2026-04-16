import React from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FormatToken } from '@/lib/whatsappFormat';

interface FormatToolbarProps {
  onFormat: (token: FormatToken) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  disabled?: boolean;
  className?: string;
}

const ACTIONS: Array<{ token: FormatToken; icon: React.ComponentType<{ className?: string }>; title: string }> = [
  { token: 'bold', icon: Bold, title: 'Negrito (*texto*)' },
  { token: 'italic', icon: Italic, title: 'Itálico (_texto_)' },
  { token: 'strike', icon: Strikethrough, title: 'Tachado (~texto~)' },
  { token: 'code', icon: Code, title: 'Código inline (`texto`)' },
  { token: 'bullet', icon: List, title: 'Lista' },
  { token: 'numbered', icon: ListOrdered, title: 'Lista numerada' },
  { token: 'quote', icon: Quote, title: 'Citação' },
];

export function FormatToolbar({ onFormat, showPreview, onTogglePreview, disabled, className }: FormatToolbarProps) {
  return (
    <div className={cn('flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30', className)}>
      {ACTIONS.map(({ token, icon: Icon, title }) => (
        <Button
          key={token}
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onFormat(token)}
          disabled={disabled}
          title={title}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
      <div className="ml-auto">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('h-7 w-7', showPreview && 'bg-accent text-accent-foreground')}
          onClick={onTogglePreview}
          disabled={disabled}
          title={showPreview ? 'Ocultar pré-visualização' : 'Pré-visualizar'}
        >
          {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
