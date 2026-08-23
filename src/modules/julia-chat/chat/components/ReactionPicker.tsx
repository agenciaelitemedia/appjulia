import React from 'react';
import { Smile } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  align?: 'start' | 'end' | 'center';
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function ReactionPicker({ onSelect, align = 'start', side = 'top', className }: ReactionPickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity', className)}
          aria-label="Reagir"
        >
          <Smile className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        className="w-auto p-1.5 flex gap-0.5 rounded-full"
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-lg transition-transform hover:scale-125"
            onClick={() => onSelect(emoji)}
          >
            {emoji}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
