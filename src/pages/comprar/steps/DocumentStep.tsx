import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { maskCPFCNPJ, unmask } from '@/lib/inputMasks';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, Search, Loader2 } from 'lucide-react';
import type { OrderData } from '../ComprarPage';

interface Props {
  orderData: OrderData;
  updateOrder: (data: Partial<OrderData>) => void;
  onNext: () => void;
}

export const DocumentStep = ({ orderData, updateOrder, onNext }: Props) => {
  const [document, setDocument] = useState(orderData.customer_document);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (value: string) => {
    setDocument(maskCPFCNPJ(value));
    setError('');
  };

  const validateDocument = (doc: string) => {
    const digits = unmask(doc);
    return digits.length === 11 || digits.length === 14;
  };

  const handleNext = async () => {
    if (!validateDocument(document)) {
      setError('CPF ou CNPJ inválido');
      return;
    }

    setLoading(true);
    const digits = unmask(document);

    try {
      // 1. Check if customer already exists in julia_orders
      const { data: existing } = await supabase
        .from('julia_orders')
        .select('*')
        .eq('customer_document', digits)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existing && existing.length > 0) {
        const prev = existing[0];
        updateOrder({
          customer_document: digits,
          customer_name: prev.customer_name || '',
          customer_email: prev.customer_email || '',
          customer_whatsapp: prev.customer_whatsapp || '',
          customer_address: prev.customer_address || '',
        });
        onNext();
        return;
      }

      // 2. Not found locally — query external API for name/data
      try {
        const { data: apiResult, error: apiError } = await supabase.functions.invoke('consulta-documento', {
          body: { document: digits },
        });

        if (!apiError && apiResult?.success && apiResult.data) {
          const d = apiResult.data;
          updateOrder({
            customer_document: digits,
            customer_name: d.name || '',
            customer_email: d.email || '',
            customer_whatsapp: d.phone || '',
            customer_address: d.address || '',
          });
          onNext();
          return;
        }
      } catch (e) {
        console.warn('External lookup failed, continuing without data:', e);
      }

      // 3. Fallback — just save the document
      updateOrder({ customer_document: digits });
      onNext();
    } catch {
      updateOrder({ customer_document: digits });
      onNext();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-xl shadow-[#6C3AED]/5 bg-white/80 backdrop-blur">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl text-[#1a1a2e]">Bem-vindo!</CardTitle>
        <CardDescription className="text-base text-gray-500">
          Informe seu CPF ou CNPJ para começar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div className="space-y-2">
          <Label htmlFor="document" className="text-[#1a1a2e] font-medium">
            CPF / CNPJ
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              id="document"
              value={document}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="000.000.000-00"
              className="pl-10 h-12 text-lg border-gray-200 focus-visible:ring-[#6C3AED]"
              onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-xs text-gray-400">
            Seus dados serão preenchidos automaticamente quando possível.
          </p>
        </div>

        <Button
          onClick={handleNext}
          disabled={!document || loading}
          className="w-full h-12 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white text-base font-semibold rounded-xl"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Continuar
              <ArrowRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
