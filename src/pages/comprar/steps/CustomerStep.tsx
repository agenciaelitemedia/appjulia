import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { maskPhone } from '@/lib/inputMasks';
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight, ArrowLeft, Loader2, User, Mail, Phone, MapPin } from 'lucide-react';
import type { OrderData } from '../ComprarPage';

interface Props {
  orderData: OrderData;
  updateOrder: (data: Partial<OrderData>) => void;
  onNext: () => void;
  onBack: () => void;
}

export const CustomerStep = ({ orderData, updateOrder, onNext, onBack }: Props) => {
  const [form, setForm] = useState({
    name: orderData.customer_name,
    email: orderData.customer_email,
    whatsapp: orderData.customer_whatsapp,
    address: orderData.customer_address,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Nome é obrigatório';
    if (!form.email.trim() || !form.email.includes('@')) errs.email = 'E-mail inválido';
    if (!form.whatsapp.trim() || form.whatsapp.replace(/\D/g, '').length < 10) errs.whatsapp = 'WhatsApp inválido';
    if (!form.address.trim()) errs.address = 'Endereço é obrigatório';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    const payload = {
      customer_document: orderData.customer_document,
      customer_name: form.name.trim(),
      customer_email: form.email.trim(),
      customer_whatsapp: form.whatsapp.replace(/\D/g, ''),
      customer_address: form.address.trim(),
      status: 'draft' as const,
    };

    try {
      let orderId = orderData.id;

      if (orderId) {
        // Update existing order
        const { error } = await supabase
          .from('julia_orders')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', orderId);
        if (error) throw error;
      } else {
        // Insert new order
        const { data, error } = await supabase
          .from('julia_orders')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        orderId = data.id;
      }

      updateOrder({
        id: orderId,
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_whatsapp: payload.customer_whatsapp,
        customer_address: payload.customer_address,
      });
      onNext();
    } catch (err) {
      console.error('Error saving draft:', err);
      updateOrder({
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        customer_whatsapp: payload.customer_whatsapp,
        customer_address: payload.customer_address,
      });
      onNext();
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "h-12 pl-10 border-gray-200 focus-visible:ring-[#6C3AED]";

  return (
    <Card className="border-0 shadow-xl shadow-[#6C3AED]/5 bg-white/80 backdrop-blur">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl text-[#1a1a2e]">Seus dados</CardTitle>
        <CardDescription className="text-base text-gray-500">
          Preencha suas informações para continuar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-1.5">
          <Label className="text-[#1a1a2e] font-medium">Nome completo / Razão Social</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Seu nome completo" className={inputClass} />
          </div>
          {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[#1a1a2e] font-medium">E-mail</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" className={inputClass} />
          </div>
          {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[#1a1a2e] font-medium">WhatsApp</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={form.whatsapp} onChange={(e) => setForm(f => ({ ...f, whatsapp: maskPhone(e.target.value) }))} placeholder="(00) 00000-0000" className={inputClass} />
          </div>
          {errors.whatsapp && <p className="text-xs text-red-500">{errors.whatsapp}</p>}
        </div>

        <div className="space-y-1.5">
          <Label className="text-[#1a1a2e] font-medium">Endereço</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Rua, número, cidade - UF" className={inputClass} />
          </div>
          {errors.address && <p className="text-xs text-red-500">{errors.address}</p>}
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onBack} className="h-12 rounded-xl border-gray-200">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-12 bg-[#6C3AED] hover:bg-[#5B2BD4] text-white font-semibold rounded-xl">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (<>Continuar <ArrowRight className="w-5 h-5 ml-2" /></>)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
