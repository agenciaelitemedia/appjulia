import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ArrowLeft } from 'lucide-react';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import type { ContractDraft } from '../types';

interface Props {
  draft: ContractDraft;
  onChange: (next: ContractDraft) => void;
  onNext: () => void;
  onBack: () => void;
  busy?: boolean;
}

export function ConfirmDataStep({ draft, onChange, onNext, onBack, busy }: Props) {
  const { user } = useAuth();
  const [autofilled, setAutofilled] = useState(false);

  useEffect(() => {
    if (autofilled || !user?.id) return;

    (async () => {
      try {
        const rows = await externalDb.raw<{
          name: string; email: string; whatsapp?: string; cnpj?: string; document?: string;
        }>({
          query: `
            SELECT u.name, u.email, COALESCE(u.whatsapp, u.phone) as whatsapp,
                   c.cnpj, c.document
            FROM users u
            LEFT JOIN clients c ON c.id = u.client_id
            WHERE u.id = $1
            LIMIT 1
          `,
          params: [user.id],
        });
        const r = rows?.[0];
        if (r) {
          onChange({
            ...draft,
            customer_name: draft.customer_name || r.name || '',
            customer_email: draft.customer_email || r.email || '',
            customer_whatsapp: draft.customer_whatsapp || r.whatsapp || '',
            customer_document: draft.customer_document || r.cnpj || r.document || '',
          });
        }
      } catch (err) {
        console.warn('[ConfirmDataStep] autofill failed', err);
      } finally {
        setAutofilled(true);
      }
    })();
  }, [user?.id, autofilled, draft, onChange]);

  const canContinue = draft.customer_name.trim() && draft.customer_email.trim() && draft.customer_document.trim();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Confirme seus dados</CardTitle>
        <p className="text-sm text-muted-foreground">
          Esses dados serão usados para a nota fiscal e contato com o cliente.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome / Razão Social *</Label>
          <Input
            id="name"
            value={draft.customer_name}
            onChange={(e) => onChange({ ...draft, customer_name: e.target.value })}
            placeholder="Empresa LTDA"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="document">CPF / CNPJ *</Label>
          <Input
            id="document"
            value={draft.customer_document}
            onChange={(e) => onChange({ ...draft, customer_document: e.target.value })}
            placeholder="00.000.000/0000-00"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email" type="email"
              value={draft.customer_email}
              onChange={(e) => onChange({ ...draft, customer_email: e.target.value })}
              placeholder="contato@exemplo.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input
              id="whatsapp"
              value={draft.customer_whatsapp}
              onChange={(e) => onChange({ ...draft, customer_whatsapp: e.target.value })}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack} disabled={busy}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <Button onClick={onNext} disabled={!canContinue || busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
            Ir para pagamento
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
