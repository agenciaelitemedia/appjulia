import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  id: string;
  text: string | null;
  caption: string | null;
  timestamp: string | null;
  from_me: boolean | null;
  contact_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId?: string | null;
  clientId: string;
  onPickMessage?: (msg: SearchResult) => void;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  const parts = text.split(re);
  return parts.map((p, i) =>
    re.test(p) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-500/30 rounded px-0.5">{p}</mark> : <span key={i}>{p}</span>
  );
}

export function ChatSearchDialog({ open, onOpenChange, contactId, clientId, onPickMessage }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (term: string) => {
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      let qb = supabase
        .from('chat_messages')
        .select('id,text,caption,timestamp,from_me,contact_id')
        .eq('client_id', clientId)
        .or(`text.ilike.%${term}%,caption.ilike.%${term}%`)
        .order('timestamp', { ascending: false })
        .limit(50);
      if (contactId) qb = qb.eq('contact_id', contactId);
      const { data } = await qb;
      setResults((data || []) as SearchResult[]);
    } finally {
      setLoading(false);
    }
  }, [clientId, contactId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => search(q), 250);
    return () => clearTimeout(t);
  }, [q, open, search]);

  useEffect(() => {
    if (!open) {
      setQ('');
      setResults([]);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            {contactId ? 'Buscar nesta conversa' : 'Buscar em todas as conversas'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            autoFocus
            placeholder="Digite ao menos 2 caracteres…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <div className="max-h-[60vh] overflow-y-auto space-y-1.5">
            {loading && (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Buscando…
              </div>
            )}

            {!loading && q.length >= 2 && results.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                Nenhuma mensagem encontrada.
              </p>
            )}

            {results.map((r) => {
              const text = r.text || r.caption || '';
              return (
                <button
                  key={r.id}
                  onClick={() => onPickMessage?.(r)}
                  className="w-full text-left border rounded-lg p-2.5 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                    <span>{r.from_me ? 'Você' : 'Contato'}</span>
                    <span>{r.timestamp ? new Date(r.timestamp).toLocaleString('pt-BR') : ''}</span>
                  </div>
                  <div className="text-sm line-clamp-3 break-words">
                    {highlight(text, q)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
