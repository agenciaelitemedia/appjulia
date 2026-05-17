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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (autofilled || !user?.id) return;
    setLoading(true);
    (async () => {
      try {
        const rows = await externalDb.raw<{
          user_name: string;
          user_email: string;
          client_name: string | null;
          client_business_name: string | null;
          client_email: string | null;
          client_phone: string | null;
          client_federal_id: string | null;
        }>({
          query: `
            SELECT u.name AS user_name, u.email AS user_email,
                   c.name AS client_name, c.business_name AS client_business_name,
                   c.email AS client_email, c.phone AS client_phone,
                   c.federal_id AS client_federal_id
            FROM users u LEFT JOIN clients c ON c.id = u.client_id
            WHERE u.id = $1 LIMIT 1`,
          params: [user.id],
        });
        const r = rows?.[0];
        if (r) {
          onChange({
            ...draft,
            customer_name: draft.customer_name || (r.client_business_name || r.client_name || r.user_name || ''),
            customer_email: draft.customer_email || (r.client_email || r.user_email || ''),
            customer_whatsapp: draft.customer_whatsapp || (r.client_phone || ''),
            customer_document: draft.customer_document || (r.client_federal_id || ''),
          });
        }
      } catch (err) {
        console.warn('[ConfirmDataStep] autofill failed', err);
      } finally {
        setAutofilled(true);
        setLoading(false);
      }
    })();
  }, [user?.id, autofilled, draft, onChange]);

  const canContinue = draft.customer_name.trim() && draft.customer_email.trim() && draft.customer_document.trim();

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Confirme seus dados</CardTitle>
        <p className="text-sm text-muted-foreground">Esses dados serão usados para a nota fiscal e contato.</p>
      </CardHeader>
      <CardContent className="space-y-4 relative min-h-[280px]">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-sm rounded-md">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando seus dados...</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome / Razão Social *</Label>
          <Input id="name" value={draft.customer_name} onChange={(e) => onChange({ ...draft, customer_name: e.target.value })} placeholder="Empresa LTDA" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="document">CPF / CNPJ *</Label>
          <Input id="document" value={draft.customer_document} onChange={(e) => onChange({ ...draft, customer_document: e.target.value })} placeholder="00.000.000/0000-00" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" type="email" value={draft.customer_email} onChange={(e) => onChange({ ...draft, customer_email: e.target.value })} placeholder="contato@exemplo.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" value={draft.customer_whatsapp} onChange={(e) => onChange({ ...draft, customer_whatsapp: e.target.value })} placeholder="(11) 99999-9999" />
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