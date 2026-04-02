import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, ArrowRight, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
import type { OrderData } from '../ComprarPage';

interface Props {
  orderData: OrderData;
  onNext: () => void;
  onBack: () => void;
}

const periodLabels: Record<string, string> = {
  monthly: 'Mensal',
  semiannual: 'Semestral',
  annual: 'Anual',
};

export const ContractStep = ({ orderData, onNext, onBack }: Props) => {
  const [contractBody, setContractBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
  };

  useEffect(() => {
    const fetchContract = async () => {
      const { data } = await supabase
        .from('julia_contract_template')
        .select('body_markdown')
        .limit(1)
        .single();

      if (data?.body_markdown) {
        const body = data.body_markdown
          .replace(/\{\{customer_name\}\}/g, orderData.customer_name || '—')
          .replace(/\{\{customer_document\}\}/g, orderData.customer_document || '—')
          .replace(/\{\{customer_email\}\}/g, orderData.customer_email || '—')
          .replace(/\{\{customer_whatsapp\}\}/g, orderData.customer_whatsapp || '—')
          .replace(/\{\{customer_address\}\}/g, orderData.customer_address || '—')
          .replace(/\{\{plan_name\}\}/g, orderData.plan_name || '—')
          .replace(/\{\{plan_price\}\}/g, formatPrice(orderData.plan_price))
          .replace(/\{\{billing_period\}\}/g, periodLabels[orderData.billing_period] || orderData.billing_period);
        setContractBody(body);
      }
      setLoading(false);
    };
    fetchContract();
  }, [orderData]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C3AED]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[#1a1a2e]">Contrato de Licença</h2>
        <p className="text-gray-500 mt-1">Leia atentamente os termos antes de prosseguir</p>
      </div>

      <Card className="border-0 shadow-xl shadow-[#6C3AED]/5 bg-white/80 backdrop-blur">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2 text-[#1a1a2e]">
            <FileText className="w-5 h-5 text-[#6C3AED]" />
            Contrato de Licença de Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[400px] rounded-xl border border-gray-100 bg-gray-50/50 p-5">
            <div className="prose prose-sm max-w-none prose-headings:text-[#1a1a2e] prose-strong:text-[#1a1a2e] pr-4">
              <ReactMarkdown>{contractBody}</ReactMarkdown>
            </div>
          </ScrollArea>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F8F7FF] border border-[#6C3AED]/10">
            <Checkbox
              id="accept-contract"
              checked={accepted}
              onCheckedChange={(checked) => setAccepted(checked === true)}
              className="mt-0.5"
            />
            <label
              htmlFor="accept-contract"
              className="text-sm text-gray-700 cursor-pointer leading-relaxed"
            >
              Li e aceito integralmente todas as condições, riscos, limitações e responsabilidades descritas no contrato acima.
            </label>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onBack} className="h-12 rounded-xl border-gray-200">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button
              onClick={onNext}
              disabled={!accepted}
              className="flex-1 h-12 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white font-semibold rounded-xl disabled:opacity-50"
            >
              Continuar <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
