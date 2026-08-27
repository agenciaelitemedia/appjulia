import { useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../extend/ui';
import { NewConversationDialog } from '../extend/chat';
import { useAuth } from '../extend/auth';

interface Props {
  /** Filas acessíveis (mesma fonte da lista) para o dialog. */
  queues: any[];
  /** Mapa de status de conexão das filas. */
  queueConnectionMap: Map<string, boolean | null>;
  clientId?: string | null;
  /** Fecha o painel expansível ao iniciar a conversa. */
  onStarted?: () => void;
}

/**
 * Painel expansível "Iniciar nova conversa" do JulIA Chat — mesma UX e mesmas regras do
 * rodapé da lista (só filas uazapi conectadas entram no dialog).
 */
export function JuliaNewConversationPanel({ queues, queueConnectionMap, clientId }: Props) {
  const { user } = useAuth();
  const [country, setCountry] = useState('55');
  const [phone, setPhone] = useState('');
  const [open, setOpen] = useState(false);

  const dialogQueues = (queues || []).filter(
    (q: any) => q?.channel_type === 'uazapi' && queueConnectionMap.get(q.id) === true,
  );

  return (
    <div className="space-y-3 p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Iniciar nova conversa</p>
      <div className="flex items-center gap-1.5">
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="h-8 w-[72px] shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="55" className="text-xs">+55</SelectItem>
            <SelectItem value="1" className="text-xs">+1</SelectItem>
            <SelectItem value="351" className="text-xs">+351</SelectItem>
            <SelectItem value="54" className="text-xs">+54</SelectItem>
            <SelectItem value="56" className="text-xs">+56</SelectItem>
          </SelectContent>
        </Select>
        <input
          value={phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
            let fmt = digits;
            if (digits.length > 2 && digits.length <= 6) fmt = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
            else if (digits.length > 6 && digits.length <= 10) fmt = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
            else if (digits.length > 10) fmt = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
            setPhone(fmt);
          }}
          placeholder="(00) 00000-0000"
          className="h-8 flex-1 rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button
          size="sm"
          className="h-8 shrink-0 px-3 text-xs"
          disabled={phone.replace(/\D/g, '').length < 10}
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus className="mr-1 h-3.5 w-3.5" />
          Conversar
        </Button>
      </div>

      <NewConversationDialog
        open={open}
        onOpenChange={(v: boolean) => { setOpen(v); if (!v) setPhone(''); }}
        queues={dialogQueues}
        initialPhone={country + phone.replace(/\D/g, '')}
        clientId={clientId || undefined}
        currentUser={
          user
            ? {
                codAgent: (user as any)?.cod_agent ? String((user as any).cod_agent) : undefined,
                name: (user as any)?.name || '',
                id: (user as any)?.id,
              }
            : undefined
        }
      />
    </div>
  );
}
