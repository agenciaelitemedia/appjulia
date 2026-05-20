import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Send, Smile, Paperclip, Mic, Image, FileText, MapPin, X, Loader2, StickyNote, Zap, Calendar, Type, Info, HelpCircle, AlertTriangle, PenLine } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { MessageType, ChatMessage } from '@/types/chat';
import { QuickMessagePicker } from './QuickMessagePicker';
import { AudioRecorder } from './AudioRecorder';
import { MentionAutocomplete } from './MentionAutocomplete';
import { ChatInputTagButton } from './ChatInputTagButton';
import { FormatToolbar } from './FormatToolbar';
import { MessagePreview } from './MessagePreview';
import { applyFormat, type FormatToken } from '@/lib/whatsappFormat';
import { externalDb } from '@/lib/externalDb';
import { interpolateVariables } from '@/lib/messageVariables';

interface ChatInputProps {
  contactId: string;
  replyToMessage?: ChatMessage | null;
  onCancelReply?: () => void;
}

interface TeamMember { id: number | string; name: string }

const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '💯', '😊', '😍', '🤔', '👏'];

export function ChatInput({ contactId, replyToMessage, onCancelReply }: ChatInputProps) {
  const { sendMessage, sendMedia, sendInternalNote, selectedConversation, selectedContact, assignConversation, updateConversationStatus, markAsRead, setConversationStatusFilter } = useWhatsAppData();
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [noteMode, setNoteMode] = useState(false);
  const [noteType, setNoteType] = useState<'info' | 'question' | 'urgent'>('info');
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showScheduledList, setShowScheduledList] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [team, setTeam] = useState<TeamMember[]>([]);
  // Signature toggle — prepends "*Nome do Usuário:*\n" to outgoing messages.
  // Persisted per-user via localStorage; default ON.
  const signatureKey = user?.id ? `chat:signature:enabled:${user.id}` : null;
  const [signEnabled, setSignEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !signatureKey) return true;
    const v = window.localStorage.getItem(signatureKey);
    return v === null ? true : v === '1';
  });
  useEffect(() => {
    if (!signatureKey || typeof window === 'undefined') return;
    window.localStorage.setItem(signatureKey, signEnabled ? '1' : '0');
  }, [signEnabled, signatureKey]);

  /**
   * Prepend the agent signature to outgoing content.
   * Skips: empty content, internal notes (handled by caller), missing user name.
   */
  const applySignature = (content: string): string => {
    if (!signEnabled) return content;
    if (!user?.name) return content;
    if (!content || !content.trim()) return content;
    return `*${user.name}:*\n${content}`;
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Claim guard — only the assigned agent can send outbound messages.
  // Internal notes remain enabled for any observer.
  const currentUserName = user?.name || (user?.id ? String(user.id) : '');
  const isActiveStatus = !!selectedConversation && ['pending', 'open'].includes(selectedConversation.status);
  const isClosedStatus = !!selectedConversation && ['resolved', 'closed'].includes(selectedConversation.status);
  const isAssignedToMe = !!selectedConversation?.assigned_to
    && !!currentUserName
    && selectedConversation.assigned_to === currentUserName;
  const canSend = noteMode || (isAssignedToMe && isActiveStatus);
  const showClaimBanner = !!selectedConversation && isActiveStatus && !isAssignedToMe && !noteMode;
  const showReopenBanner = isClosedStatus && !noteMode;

  const handleClaim = async () => {
    if (!selectedConversation || !currentUserName || isClaiming) return;
    setIsClaiming(true);
    try {
      await assignConversation(selectedConversation.id, currentUserName);
      if (selectedConversation.status === 'pending') {
        await updateConversationStatus(selectedConversation.id, 'open');
      }
      try { await markAsRead(contactId); } catch { /* noop */ }
      setConversationStatusFilter('open');
      setTimeout(() => textareaRef.current?.focus(), 0);
    } finally {
      setIsClaiming(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedConversation || isClaiming) return;
    setIsClaiming(true);
    try {
      await updateConversationStatus(selectedConversation.id, 'open');
      if (currentUserName) {
        await assignConversation(selectedConversation.id, currentUserName);
      }
      setTimeout(() => textareaRef.current?.focus(), 0);
    } finally {
      setIsClaiming(false);
    }
  };

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

    const rawText = text.trim();
    // Interpola variáveis: {{nome}}, {{primeiro_nome}}, {{protocolo}}, {{atendente}}, {{data}}, {{hora}}
    const messageText = interpolateVariables(rawText, {
      contactName: selectedContact?.name ?? null,
      protocol: selectedConversation?.protocol ?? null,
      agentName: user?.name ?? null,
    });
    setText('');
    setIsSending(true);

    try {
      if (noteMode) {
        await sendInternalNote(
          contactId,
          messageText,
          user?.name || 'Atendente',
          { team, byId: user?.id ? String(user.id) : undefined, noteType }
        );
        // Sair do modo nota após envio bem-sucedido
        setNoteMode(false);
        setNoteType('info');
      } else {
        await sendMessage(contactId, applySignature(messageText), replyToMessage ?? undefined);
        onCancelReply?.();
      }
    } catch (error) {
      setText(rawText);
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
      const captionRaw = text.trim();
      const caption = captionRaw ? applySignature(captionRaw) : undefined;
      await sendMedia(contactId, file, 'image', caption);
      setText('');
    } finally {
      setIsSending(false);
    }
  }, [contactId, noteMode, sendMedia, text]);

  const handleQuickMessageSelect = (messageText: string) => {
    setText(messageText);
    setShowQuickMessages(false);
    textareaRef.current?.focus();
  };

  const handleAudioSend = useCallback(async (audioBlob: Blob) => {
    const blobType = (audioBlob.type || '').toLowerCase();
    const extension = blobType.includes('ogg') ? 'ogg' : blobType.includes('mp4') ? 'm4a' : 'webm';
    const mimeType = blobType || (extension === 'ogg' ? 'audio/ogg;codecs=opus' : extension === 'm4a' ? 'audio/mp4' : 'audio/webm;codecs=opus');
    const file = new File([audioBlob], `audio_${Date.now()}.${extension}`, { type: mimeType });
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

  // (Lock total removido — apenas o botão de Nota Interna permanece ativo
  // quando a conversa não está assumida; cada controle individual usa `disabled={!canSend}`.)

  return (
    <div className="border-t bg-background">
      {/* Claim/Reopen banner — same position, same layout */}
      {(showReopenBanner || showClaimBanner) && (
        <div className={cn(
          'flex items-center gap-2 px-3 py-2 border-b',
          showReopenBanner
            ? 'bg-muted/60 border-muted'
            : 'bg-amber-500/10 border-amber-500/20'
        )}>
          <span className={cn(
            'text-xs font-medium flex-1',
            showReopenBanner
              ? 'text-muted-foreground'
              : 'text-amber-700 dark:text-amber-400'
          )}>
            {showReopenBanner
              ? (selectedConversation?.status === 'closed' ? 'Conversa encerrada' : 'Conversa concluída')
              : 'Assuma esta conversa para responder. Notas internas continuam disponíveis.'}
          </span>
          <Button
            size="sm"
            variant={showReopenBanner ? 'outline' : 'default'}
            className="h-7 text-xs"
            onClick={showReopenBanner ? handleReopen : handleClaim}
            disabled={isClaiming}
          >
            {isClaiming
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : showReopenBanner ? 'Reabrir' : 'Assumir'}
          </Button>
        </div>
      )}
      {/* Note mode indicator */}
      {noteMode && (() => {
        const noteStyles = {
          info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-600', text: 'text-blue-700 dark:text-blue-400', title: 'Nota Informativa' },
          question: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', icon: 'text-yellow-700', text: 'text-yellow-800 dark:text-yellow-400', title: 'Nota de Dúvida' },
          urgent: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-600', text: 'text-red-700 dark:text-red-400', title: 'Nota de Urgência' },
        }[noteType];
        const NoteIcon = noteType === 'question' ? HelpCircle : noteType === 'urgent' ? AlertTriangle : StickyNote;
        return (
          <div className={cn('flex items-center gap-2 px-3 py-1.5 border-b', noteStyles.bg, noteStyles.border)}>
            <NoteIcon className={cn('h-3.5 w-3.5', noteStyles.icon)} />
            <span className={cn('text-xs font-medium flex-1', noteStyles.text)}>
              {noteStyles.title} — não será enviada ao contato
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setNoteMode(false); setNoteType('info'); }}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        );
      })()}

      {/* Reply indicator */}
      {replyToMessage && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted border-b border-l-2 border-l-primary">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-primary">
              {replyToMessage.from_me ? 'Você' : (replyToMessage.metadata?.sender_name || 'Contato')}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {replyToMessage.text || (replyToMessage.type !== 'text' ? `[${replyToMessage.type}]` : '...')}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Format toolbar (above input) */}
      {showFormatBar && !noteMode && (
        <FormatToolbar
          onFormat={handleFormat}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview((v) => !v)}
          disabled={isSending}
        />
      )}

      {/* Live preview */}
      {showPreview && !noteMode && showFormatBar && (
        <MessagePreview text={text} />
      )}

      <div className="p-3">
        <div className="flex items-end gap-2">
          {/* Emoji picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" disabled={!canSend}>
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
                <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" disabled={!canSend}>
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
          <Popover open={showQuickMessages} onOpenChange={(o) => canSend && setShowQuickMessages(o)}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" title="Mensagens rápidas (/)" disabled={!canSend}>
                <Zap className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" side="top" align="start">
              <QuickMessagePicker onSelect={handleQuickMessageSelect} />
            </PopoverContent>
          </Popover>

          {/* Etiquetas */}
          {!noteMode && (
            <ChatInputTagButton
              conversationId={selectedConversation?.id || null}
              disabled={!canSend}
            />
          )}

          {/* Format toggle */}
          {!noteMode && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-9 w-9 flex-shrink-0',
                showFormatBar && 'bg-accent text-accent-foreground'
              )}
              onClick={() => setShowFormatBar((v) => !v)}
              title="Formatação WhatsApp"
            >
              <Type className="h-5 w-5 text-muted-foreground" />
            </Button>
          )}

          {/* Signature toggle */}
          {!noteMode && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-9 w-9 flex-shrink-0',
                signEnabled && 'bg-accent text-accent-foreground'
              )}
              onClick={() => setSignEnabled((v) => !v)}
              title={
                signEnabled
                  ? `Assinando como "${user?.name || 'atendente'}" (clique para desativar)`
                  : 'Assinatura desativada (clique para ativar)'
              }
              disabled={!user?.name}
            >
              <PenLine className={cn('h-5 w-5', signEnabled ? 'text-foreground' : 'text-muted-foreground')} />
            </Button>
          )}

          {/* Note type menu — always available, even when conversation is not claimed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-9 w-9 flex-shrink-0',
                  noteMode && noteType === 'info' && 'bg-blue-500 text-white hover:bg-blue-600 hover:text-white',
                  noteMode && noteType === 'question' && 'bg-yellow-500 text-white hover:bg-yellow-600 hover:text-white',
                  noteMode && noteType === 'urgent' && 'bg-red-500 text-white hover:bg-red-600 hover:text-white',
                )}
                title="Nota interna"
              >
                <StickyNote className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start">
              <DropdownMenuItem onClick={() => { setNoteMode(true); setNoteType('info'); setTimeout(() => textareaRef.current?.focus(), 0); }}>
                <Info className="h-4 w-4 mr-2 text-blue-600" />
                Informativa
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNoteMode(true); setNoteType('question'); setTimeout(() => textareaRef.current?.focus(), 0); }}>
                <HelpCircle className="h-4 w-4 mr-2 text-yellow-600" />
                Dúvida
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNoteMode(true); setNoteType('urgent'); setTimeout(() => textareaRef.current?.focus(), 0); }}>
                <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
                Urgência
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
              onPaste={handlePaste}
              placeholder={
                !canSend
                  ? 'Assuma a conversa ou abra uma nota interna para escrever...'
                  : noteMode
                    ? 'Digite uma nota interna... (use @ para mencionar)'
                    : 'Digite uma mensagem... (/ atalhos, cole imagem)'
              }
              className={cn(
                'w-full min-h-[36px] max-h-[150px] py-2 resize-none',
                'scrollbar-thin scrollbar-thumb-muted',
                noteMode && 'border-blue-500/30 focus-visible:ring-blue-500'
              )}
              rows={1}
              disabled={isSending || !canSend}
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
              disabled={!canSend}
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
