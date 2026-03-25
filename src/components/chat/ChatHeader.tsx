import React from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Phone, Video, MoreVertical, Users, Archive, VolumeX, Trash2, Info, X } from 'lucide-react';
import type { ChatContact } from '@/types/chat';

interface ChatHeaderProps {
  contact: ChatContact;
  onClose: () => void;
  onShowDetails?: () => void;
}

export function ChatHeader({ contact, onClose, onShowDetails }: ChatHeaderProps) {
  const initials = contact.name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 p-3 border-b bg-background">
      <Avatar className="h-10 w-10">
        <AvatarImage src={contact.avatar} alt={contact.name} />
        <AvatarFallback className="bg-primary/10 text-primary font-medium">
          {contact.is_group ? <Users className="h-4 w-4" /> : initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <h3 className="font-medium truncate">{contact.name}</h3>
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground truncate">
            {contact.is_group ? 'Grupo' : contact.phone}
          </p>
          {(contact as any).channel_type && (
            <span className={cn(
              'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
              (contact as any).channel_type === 'whatsapp_official'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            )}>
              {(contact as any).channel_type === 'whatsapp_official' ? 'WA Oficial' : 'WhatsApp'}
            </span>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Chamada de voz">
          <Phone className="h-4 w-4" />
        </Button>
        
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Chamada de vídeo">
          <Video className="h-4 w-4" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onShowDetails}>
              <Info className="h-4 w-4 mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Archive className="h-4 w-4 mr-2" />
              {contact.is_archived ? 'Desarquivar' : 'Arquivar'}
            </DropdownMenuItem>
            <DropdownMenuItem>
              <VolumeX className="h-4 w-4 mr-2" />
              {contact.is_muted ? 'Ativar notificações' : 'Silenciar'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir conversa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 lg:hidden" 
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
