import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, Smile, Paperclip, Mic, Image, FileText, MapPin, X, Loader2, StickyNote, Zap, Calendar } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { MessageType } from '@/types/chat';
import { QuickMessagePicker } from './QuickMessagePicker';
import { AudioRecorder } from './AudioRecorder';
import { MentionAutocomplete } from './MentionAutocomplete';
import { ScheduleMessageDialog } from './ScheduleMessageDialog';
import { ScheduledMessagesList } from './ScheduledMessagesList';
import { FormatToolbar } from './FormatToolbar';
import { MessagePreview } from './MessagePreview';
import { applyFormat, type FormatToken } from '@/lib/whatsappFormat';
import { externalDb } from '@/lib/externalDb';

interface ChatInputProps {
  contactId: string;
  replyToId?: string;
  onCancelReply?: () => void;
}

interface TeamMember { id: number | string; name: string }

const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '💯', '😊', '😍', '🤔', '👏'];

export function ChatInput({ contactId, replyToId, onCancelReply }: ChatInputProps) {
  const { sendMessage, sendMedia, sendInternalNote, selectedConversation, selectedContact } = useWhatsAppData();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load team members for @mention autocomplete when entering note mode
  useEffect(() => {
    if (!noteMode || team.length > 0 || !user?.id) return;
    externalDb.getTeamMembers<TeamMember>(Number(user.id), user.role === 'admin')
      .then((m) => setTeam(m || []))
      .catch(() => setTeam([]));
  }, [noteMode, team.length, user?.id, user?.role]);

  const handleMentionPick = (member: TeamMember) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const replaced = before.replace(/@([\p{L}\p{N}_]*)$/u, `@${member.name} `);
    const newText = replaced + after;
    setText(newText);
    setTimeout(() => {
      ta.focus();
      const pos = replaced.length;
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  const handleSend = async () => {
    if (!text.trim() || isSending) return;

    const messageText = text.trim();
    setText('');
    setIsSending(true);

    try {
      if (noteMode) {
        await sendInternalNote(
          contactId,
          messageText,
          user?.name || 'Atendente',
          { team, byId: user?.id ? String(user.id) : undefined }
        );
      } else {
        await sendMessage(contactId, messageText, replyToId);
        onCancelReply?.();
      }
    } catch (error) {
      setText(messageText);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Quick messages shortcut
    if (e.key === '/' && text === '') {
      e.preventDefault();
      setShowQuickMessages(true);
    }
  };

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

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newText = text.slice(0, start) + emoji + text.slice(end);
      setText(newText);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      setText(text + emoji);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    setText(target.value);
    
    target.style.height = 'auto';
    target.style.height = Math.min(target.scrollHeight, 150) + 'px';
  };

  const handleFormat = (token: FormatToken) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    const result = applyFormat(text, start, end, token);
    setText(result.text);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(result.selStart, result.selEnd);
    }, 0);
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (noteMode) return;
    const items = Array.from(e.clipboardData?.items || []);
    const fileItem = items.find((it) => it.kind === 'file' && it.type.startsWith('image/'));
    if (!fileItem) return;
    const blob = fileItem.getAsFile();
    if (!blob) return;
    e.preventDefault();
    const ext = blob.type.split('/')[1] || 'png';
    const file = new File([blob], `pasted_${Date.now()}.${ext}`, { type: blob.type });
    setIsSending(true);
    try {
      await sendMedia(contactId, file, 'image', text.trim() || undefined);
      setText('');
    } finally {
      setIsSending(false);
    }
  }, [contactId, noteMode, sendMedia, text]);
    setText(messageText);
    setShowQuickMessages(false);
    textareaRef.current?.focus();
  };

  const handleAudioSend = useCallback(async (audioBlob: Blob) => {
    const file = new File([audioBlob], `audio_${Date.now()}.webm`, { type: 'audio/webm;codecs=opus' });
    await sendMedia(contactId, file, 'ptt');
    setIsRecording(false);
  }, [contactId, sendMedia]);

  // Audio recording mode
  if (isRecording) {
    return (
      <AudioRecorder
        onSend={handleAudioSend}
        onCancel={() => setIsRecording(false)}
      />
    );
  }

  return (
    <div className="border-t bg-background">
      {/* Note mode indicator */}
      {noteMode && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20">
          <StickyNote className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs font-medium text-blue-700 dark:text-blue-400 flex-1">
            Nota Interna — não será enviada ao contato
          </span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNoteMode(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Reply indicator */}
      {replyToId && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted border-b">
          <div className="flex-1 text-sm text-muted-foreground truncate">
            Respondendo mensagem...
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="p-3">
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
          {!noteMode && (
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
          )}

          {/* Quick Messages */}
          <Popover open={showQuickMessages} onOpenChange={setShowQuickMessages}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" title="Mensagens rápidas (/)">
                <Zap className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" side="top" align="start">
              <QuickMessagePicker onSelect={handleQuickMessageSelect} />
            </PopoverContent>
          </Popover>

          {/* Schedule */}
          {!noteMode && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 flex-shrink-0"
              onClick={() => setShowSchedule(true)}
              title="Agendar mensagem"
            >
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}

          {/* Note toggle */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'h-9 w-9 flex-shrink-0',
              noteMode && 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white'
            )}
            onClick={() => setNoteMode(!noteMode)}
            title="Nota interna"
          >
            <StickyNote className="h-5 w-5" />
          </Button>

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

          {/* Text input + mention autocomplete (note mode) */}
          <div className="flex-1 relative">
            {noteMode && (
              <MentionAutocomplete
                text={text}
                textareaRef={textareaRef}
                team={team}
                onPick={handleMentionPick}
              />
            )}
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKeyDown}
              placeholder={noteMode ? 'Digite uma nota interna... (use @ para mencionar)' : 'Digite uma mensagem... (/ para atalhos)'}
              className={cn(
                'w-full min-h-[36px] max-h-[150px] py-2 resize-none',
                'scrollbar-thin scrollbar-thumb-muted',
                noteMode && 'border-blue-500/30 focus-visible:ring-blue-500'
              )}
              rows={1}
              disabled={isSending}
            />
          </div>

          {/* Send or record button */}
          {text.trim() ? (
            <Button
              size="icon"
              className={cn(
                'h-9 w-9 flex-shrink-0',
                noteMode && 'bg-blue-500 hover:bg-blue-600'
              )}
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
              className="h-9 w-9 flex-shrink-0 hover:text-destructive"
              onClick={() => setIsRecording(true)}
              title="Gravar áudio"
            >
              <Mic className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}
        </div>
      </div>

      {/* Schedule message dialog */}
      <ScheduleMessageDialog
        open={showSchedule}
        onOpenChange={setShowSchedule}
        contactId={contactId}
        clientId={selectedContact?.client_id || ''}
        codAgent={selectedContact?.cod_agent || null}
        conversationId={selectedConversation?.id || null}
        initialText={text}
        onScheduled={() => setShowScheduledList(true)}
      />

      {/* Scheduled messages list */}
      <ScheduledMessagesList
        open={showScheduledList}
        onOpenChange={setShowScheduledList}
        contactId={contactId}
      />
    </div>
  );
}
