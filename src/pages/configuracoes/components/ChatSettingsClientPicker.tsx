import { Search, X, Building2, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClientSearch, type SearchedClient } from '@/pages/agents/hooks/useClientSearch';

interface Props {
  onSelect: (client: SearchedClient) => void;
}

export function ChatSettingsClientPicker({ onSelect }: Props) {
  const { searchTerm, setSearchTerm, results, isLoading } = useClientSearch();

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nome, escritório ou email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
          autoFocus
        />
        {searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => setSearchTerm('')}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="border rounded-lg min-h-[300px]">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        ) : searchTerm.length < 3 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-center">Digite ao menos 3 caracteres para buscar</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p>Nenhum cliente encontrado</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="p-2">
              <p className="text-sm text-muted-foreground px-2 py-1 mb-2">
                {results.length} cliente(s) encontrado(s)
              </p>
              {results.map((client) => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => onSelect(client)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{client.name}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {client.business_name || client.email || 'Sem informação adicional'}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
