import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Search } from 'lucide-react';
import { useAuth } from '../extend/auth';
import { displayPhone } from '../extend/phone';
import { useAddSuppression, useDspSuppression, useRemoveSuppression } from '../hooks/useDspSuppression';

const REASON_LABEL: Record<string, string> = {
  optout: 'Descadastro (opt-out)',
  invalid: 'Número inválido',
  manual: 'Bloqueio manual',
  complaint: 'Reclamação',
};

export function SuppressionTab({ clientId, canEdit }: { clientId: string | null; canEdit: boolean }) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('manual');
  const [notes, setNotes] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  const { data: rows = [] } = useDspSuppression(clientId, search);
  const add = useAddSuppression();
  const remove = useRemoveSuppression();

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm">Adicionar à supressão</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] space-y-1.5">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999998888" />
            </div>
            <div className="min-w-[180px] space-y-1.5">
              <Label>Motivo</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REASON_LABEL).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label>Observação</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <Button
              className="gap-2"
              disabled={!phone.trim() || !clientId || add.isPending}
              onClick={() =>
                add.mutate(
                  {
                    client_id: String(clientId),
                    phone,
                    reason,
                    notes: notes || undefined,
                    created_by: user?.id != null ? String(user.id) : null,
                  },
                  { onSuccess: () => { setPhone(''); setNotes(''); } },
                )
              }
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar telefone..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Lista de supressão ({rows.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhum número suprimido.</p>}
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border px-2 py-1.5 text-sm">
              <span className="font-medium">{displayPhone(r.phone_e164)}</span>
              <Badge variant="outline" className="text-[10px]">
                {REASON_LABEL[r.reason ?? ''] ?? r.reason ?? '—'}
              </Badge>
              {r.notes && <span className="text-xs text-muted-foreground">{r.notes}</span>}
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString('pt-BR')}
              </span>
              {canEdit && (
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRemoving(r.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover da supressão?</AlertDialogTitle>
            <AlertDialogDescription>
              O número voltará a receber campanhas. Só remova com autorização do contato.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (removing) remove.mutate(removing); setRemoving(null); }}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
