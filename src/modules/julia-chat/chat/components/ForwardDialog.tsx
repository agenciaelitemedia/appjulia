import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SmartAvatarImage } from '@/components/chat/SmartAvatarImage';
import { Checkbox } from '@/components/ui/checkbox';
import { Forward, Search, Loader2 } from 'lucide-react';
import { useWhatsAppData } from '@/contexts/WhatsAppDataContext';
import { toast } from 'sonner';
import type { ChatMessage } from '@/types/chat';

interface ForwardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ChatMessage | null;
}

export function ForwardDialog({ open, onOpenChange, message }: ForwardDialogProps) {
  const { contacts, sendMessage } = useWhatsAppData();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts.slice(0, 50);
    return contacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 50);
  }, [contacts, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const buildPreview = (): string => {
    if (!message) return '';
    if (message.text) return message.text;
    if (message.caption) return message.caption;
    if (message.type === 'image') return '🖼️ Imagem';
    if (message.type === 'video') return '🎬 Vídeo';
    if (message.type === 'audio' || message.type === 'ptt') return '🎵 Áudio';
    if (message.type === 'document') return `📄 ${message.file_name || 'Documento'}`;
    if (message.type === 'location') return '📍 Localização';
    return 'Mensagem encaminhada';
  };

  const handleForward = async () => {
    if (!message || selected.size === 0) return;
    setSending(true);
    const previewText = buildPreview();
    let okCount = 0;
    let failCount = 0;
    for (const id of selected) {
      try {
        // Encaminha marcando a flag `forward: true` no provedor.
        // Para mídia ainda enviamos o texto/preview — re-upload do binário
        // fica fora do escopo deste fluxo.
        const fwdText = message.text || message.caption || previewText;
        await sendMessage(id, fwdText, undefined, { forward: true });
        okCount++;
      } catch {
        failCount++;
      }
    }
    setSending(false);
    if (okCount > 0) toast.success(`Encaminhada para ${okCount} contato(s)`);
    if (failCount > 0) toast.error(`Falha em ${failCount} envio(s)`);
    setSelected(new Set());
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-4 w-4" />
            Encaminhar mensagem
          </DialogTitle>
          <DialogDescription>
            Selecione um ou mais contatos para encaminhar.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <div className="bg-muted/50 rounded-md p-2 text-sm border-l-2 border-primary">
            <p className="line-clamp-2 break-words">{buildPreview()}</p>
          </div>
        )}

        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-72">
          <div className="space-y-1 pr-3">
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                Nenhum contato encontrado
              </p>
            )}
            {filtered.map((c) => {
              const initials = c.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
              const isSelected = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggle(c.id)}
                  className={`w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted transition-colors text-left ${isSelected ? 'bg-muted' : ''}`}
                >
                  <Checkbox checked={isSelected} onCheckedChange={() => toggle(c.id)} />
                  <Avatar className="h-8 w-8">
                    <SmartAvatarImage src={c.avatar} alt={c.name} contactId={c.id} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={handleForward} disabled={selected.size === 0 || sending}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Encaminhar ({selected.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
