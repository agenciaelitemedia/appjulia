import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ChatContact } from '@/types/chat';

interface ChatContactItemProps {
  contact: ChatContact;
  isSelected: boolean;
  onClick: () => void;
}

export const ChatContactItem = React.memo(function ChatContactItem({
  contact,
  isSelected,
  onClick,
}: ChatContactItemProps) {
  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  const formattedTime = contact.last_message_at
    ? formatDistanceToNow(new Date(contact.last_message_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : null;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 text-left transition-colors rounded-lg',
        'hover:bg-accent/50',
        isSelected && 'bg-accent'
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={contact.avatar} alt={contact.name} />
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {contact.is_group ? <Users className="h-5 w-5" /> : initials}
          </AvatarFallback>
        </Avatar>
        
        {contact.unread_count > 0 && (
          <Badge
            variant="default"
            className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 text-xs"
          >
            {contact.unread_count > 99 ? '99+' : contact.unread_count}
          </Badge>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'font-medium truncate',
            contact.unread_count > 0 && 'text-foreground'
          )}>
            {contact.name}
          </span>
          {formattedTime && (
            <span className={cn(
              'text-xs flex-shrink-0',
              contact.unread_count > 0 ? 'text-primary font-medium' : 'text-muted-foreground'
            )}>
              {formattedTime}
            </span>
          )}
        </div>
        
        {contact.last_message_text && (
          <p className={cn(
            'text-sm truncate mt-0.5',
            contact.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
          )}>
            {contact.last_message_text}
          </p>
        )}
      </div>
    </button>
  );
});
