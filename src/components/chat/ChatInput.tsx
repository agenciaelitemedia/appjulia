import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, Smile, Paperclip, Mic, Image, FileText, MapPin, X, Loader2 } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { cn } from '@/lib/utils';
import type { MessageType } from '@/types/chat';

interface ChatInputProps {
  contactId: string;
  replyToId?: string;
  onCancelReply?: () => void;
}

// Common emojis for quick access
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '💯', '😊', '😍', '🤔', '👏'];

export function ChatInput({ contactId, replyToId, onCancelReply }: ChatInputProps) {
  const { sendMessage, sendMedia } = useWhatsAppData();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle send message
  const handleSend = async () => {
    if (!text.trim() || isSending) return;

    const messageText = text.trim();
    setText('');
    setIsSending(true);

    try {
      await sendMessage(contactId, messageText, replyToId);
      onCancelReply?.();
    } catch (error) {
      // Error is handled in context
      setText(messageText); // Restore text on error
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>, type: MessageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSending(true);
    try {
      await sendMedia(contactId, file, type);
    } finally {
      setIsSending(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [contactId, sendMedia]);

  // Handle emoji insert
  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setText(text + emoji);
    }
  };

  // Auto-resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setText(target.value);
    
    // Reset height to auto to get accurate scrollHeight
    target.style.height = 'auto';
    // Set new height (max 150px)
    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
  };

  return (
    <div className="border-t bg-background p-3">
      {/* Reply indicator */}
      {replyToId && (
        <div className="flex items-center gap-2 mb-2 px-2 py-1 bg-muted rounded-lg">
          <div className="flex-1 text-sm text-muted-foreground truncate">
            Respondendo mensagem...
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onCancelReply}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {/* Emoji picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Smile className="h-5 w-5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top" align="start">
            <div className="grid grid-cols-6 gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-lg"
                  onClick={() => insertEmoji(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachments */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0">
              <Paperclip className="h-5 w-5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem onClick={() => {
              fileInputRef.current?.setAttribute('accept', 'image/*');
              fileInputRef.current?.click();
            }}>
              <Image className="h-4 w-4 mr-2 text-primary" />
              Imagem
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              fileInputRef.current?.setAttribute('accept', 'video/*');
              fileInputRef.current?.click();
            }}>
              <FileText className="h-4 w-4 mr-2 text-primary" />
              Vídeo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              fileInputRef.current?.setAttribute('accept', '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt');
              fileInputRef.current?.click();
            }}>
              <FileText className="h-4 w-4 mr-2 text-primary" />
              Documento
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <MapPin className="h-4 w-4 mr-2 text-primary" />
              Localização
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const accept = fileInputRef.current?.getAttribute('accept') || '';
            let type: MessageType = 'document';
            if (accept.includes('image')) type = 'image';
            else if (accept.includes('video')) type = 'video';
            handleFileSelect(e, type);
          }}
        />

        {/* Text input */}
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          className={cn(
            'flex-1 min-h-[36px] max-h-[150px] py-2 resize-none',
            'scrollbar-thin scrollbar-thumb-muted'
          )}
          rows={1}
          disabled={isSending}
        />

        {/* Send or record button */}
        {text.trim() ? (
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={handleSend}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-9 w-9 flex-shrink-0',
              isRecording && 'text-destructive animate-pulse'
            )}
            onClick={() => setIsRecording(!isRecording)}
            disabled
            title="Gravação de áudio (em breve)"
          >
            <Mic className="h-5 w-5 text-muted-foreground" />
          </Button>
        )}
      </div>
    </div>
  );
}
