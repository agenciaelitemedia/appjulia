import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMvpLeadSearch, type MvpLeadOption } from '../hooks/useMvpLeadSearch';

interface Props {
  term: string;
  onTermChange: (v: string) => void;
  selected: MvpLeadOption | null;
  onSelect: (lead: MvpLeadOption) => void;
}

export function LeadPicker({ term, onTermChange, selected, onSelect }: Props) {
  const { data: leads = [], isLoading } = useMvpLeadSearch(term);

  return (
    <Card className="flex flex-col h-full min-h-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">1. Escolher o lead</CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            placeholder="Buscar por telefone ou nome"
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-0">
        <ScrollArea className="h-full max-h-[420px]">
          <div className="px-3 pb-3 space-y-1">
            {isLoading && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && !leads.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
            )}
            {leads.map((lead) => (
              <button
                key={lead.contactId}
                onClick={() => onSelect(lead)}
                className={cn(
                  'w-full text-left rounded-md border-2 p-2 transition-colors',
                  selected?.contactId === lead.contactId
                    ? 'border-primary bg-primary/5'
                    : 'border-transparent hover:bg-muted/60',
                )}
              >
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate">{lead.name || lead.phone || 'Sem nome'}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{lead.phone}</p>
                {lead.lastMessageText && (
                  <p className="text-xs text-muted-foreground/80 truncate">{lead.lastMessageText}</p>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
