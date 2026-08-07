/**
 * Barra de escopo: permite ao admin escolher o escritório (clientID)
 * cujos agentes X-Julia serão criados/gerenciados.
 */
import { useState } from 'react';
import { Building2, Loader2, Search, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useXJScope } from '../context/XJScopeContext';
import { useXJClientSearch } from '../extend/clients';

export function XJScopeBar() {
  const { canSwitch, clientId, clientLabel, isOverridden, setScope, resetScope } = useXJScope();
  const [open, setOpen] = useState(false);
  const { searchTerm, setSearchTerm, results, isLoading, clearSearch } = useXJClientSearch();

  if (!canSwitch) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">Escritório:</span>
      <Badge variant={isOverridden ? 'default' : 'secondary'}>
        {clientLabel || (clientId ? `ClientID ${clientId}` : 'não identificado')}
      </Badge>

      <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) clearSearch(); }}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            <Search className="mr-1.5 h-3.5 w-3.5" /> Trocar
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-2" align="start">
          <Input
            autoFocus
            placeholder="Buscar escritório (mín. 3 letras)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando...
              </div>
            )}
            {!isLoading && searchTerm.length >= 3 && results.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">Nenhum escritório encontrado.</p>
            )}
            {results.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => {
                  setScope(String(client.id), client.business_name || client.name);
                  setOpen(false);
                  clearSearch();
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <span className="block font-medium">{client.business_name || client.name}</span>
                <span className="block text-xs text-muted-foreground">
                  ClientID {client.id}
                  {client.email ? ` · ${client.email}` : ''}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {isOverridden && (
        <Button size="sm" variant="ghost" onClick={resetScope}>
          <X className="mr-1 h-3.5 w-3.5" /> Voltar ao meu escritório
        </Button>
      )}
    </div>
  );
}