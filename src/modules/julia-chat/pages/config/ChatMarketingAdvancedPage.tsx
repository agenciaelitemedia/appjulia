import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, FlaskConical, TrendingUp, Target } from "lucide-react";
import { useCampaignVariants, useCreateVariant, useDeleteVariant } from "@/hooks/useChatCampaignVariants";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function ChatMarketingAdvancedPage() {
  const { user } = useAuth();
  const clientId = (user as any)?.cod_agent || "default";
  const [selectedCampaign, setSelectedCampaign] = useState<string | undefined>();
  const [newVariant, setNewVariant] = useState({ label: "", message_text: "", weight: 50 });

  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns-for-ab", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("chat_campaigns").select("id,name,status,contacts_total,contacts_sent").eq("client_id", clientId).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: variants = [] } = useCampaignVariants(selectedCampaign);
  const createVariant = useCreateVariant();
  const deleteVariant = useDeleteVariant();

  const totalSent = variants.reduce((a, v) => a + v.contacts_sent, 0);
  const totalConverted = variants.reduce((a, v) => a + v.contacts_converted, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FlaskConical className="h-7 w-7 text-primary" />
          Marketing Avançado
        </h1>
        <p className="text-muted-foreground">A/B testing, agendamento recorrente e métricas de conversão</p>
      </div>

      <Tabs defaultValue="ab">
        <TabsList>
          <TabsTrigger value="ab"><FlaskConical className="h-4 w-4 mr-2" />A/B Testing</TabsTrigger>
          <TabsTrigger value="metrics"><TrendingUp className="h-4 w-4 mr-2" />Conversão</TabsTrigger>
        </TabsList>

        <TabsContent value="ab" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Selecionar campanha</CardTitle></CardHeader>
            <CardContent>
              <select className="w-full border rounded-md p-2 bg-background" value={selectedCampaign || ""} onChange={(e) => setSelectedCampaign(e.target.value || undefined)}>
                <option value="">— Selecione —</option>
                {campaigns.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
              </select>
            </CardContent>
          </Card>

          {selectedCampaign && (
            <>
              <Card>
                <CardHeader><CardTitle>Nova variante</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Input placeholder="Rótulo (ex: Versão A)" value={newVariant.label} onChange={(e) => setNewVariant({ ...newVariant, label: e.target.value })} />
                  <Textarea placeholder="Texto da mensagem" value={newVariant.message_text} onChange={(e) => setNewVariant({ ...newVariant, message_text: e.target.value })} />
                  <div className="flex items-center gap-3">
                    <label className="text-sm">Peso (%):</label>
                    <Input type="number" className="w-24" value={newVariant.weight} onChange={(e) => setNewVariant({ ...newVariant, weight: Number(e.target.value) })} />
                    <Button onClick={async () => {
                      if (!newVariant.label || !newVariant.message_text) return;
                      await createVariant.mutateAsync({ campaign_id: selectedCampaign, ...newVariant });
                      setNewVariant({ label: "", message_text: "", weight: 50 });
                    }}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>Variantes ({variants.length})</CardTitle></CardHeader>
                <CardContent>
                  {variants.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6">Nenhuma variante. Crie ao menos 2 para iniciar o teste A/B.</p>
                  ) : (
                    <div className="space-y-3">
                      {variants.map((v) => {
                        const convRate = v.contacts_sent ? ((v.contacts_converted / v.contacts_sent) * 100).toFixed(1) : "0.0";
                        const replyRate = v.contacts_sent ? ((v.contacts_replied / v.contacts_sent) * 100).toFixed(1) : "0.0";
                        return (
                          <div key={v.id} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2"><Badge>{v.label}</Badge><span className="text-xs text-muted-foreground">peso {v.weight}%</span></div>
                              <Button size="icon" variant="ghost" onClick={() => deleteVariant.mutate(v.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <p className="text-sm">{v.message_text}</p>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div><div className="text-muted-foreground">Enviadas</div><div className="font-bold">{v.contacts_sent}</div></div>
                              <div><div className="text-muted-foreground">Entregues</div><div className="font-bold">{v.contacts_delivered}</div></div>
                              <div><div className="text-muted-foreground">Respostas</div><div className="font-bold text-blue-600">{replyRate}%</div></div>
                              <div><div className="text-muted-foreground">Conversão</div><div className="font-bold text-emerald-600">{convRate}%</div></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Enviadas (variantes)</div><div className="text-3xl font-bold">{totalSent}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Conversões</div><div className="text-3xl font-bold text-emerald-600">{totalConverted}</div></CardContent></Card>
            <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" />Taxa conversão</div><div className="text-3xl font-bold">{totalSent ? ((totalConverted / totalSent) * 100).toFixed(1) : 0}%</div></CardContent></Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
