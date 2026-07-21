import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { blitzSupabase, BLITZ_TABLES } from "@/blitzleads/lib/blitzClient";
import { useBlitzRouteMap } from "@/blitzleads/hooks/useBlitzRouteMap";
import { useQueryClient } from "@tanstack/react-query";

type Row = { key: string; value: string };

export function BlitzLeadsConfigTab() {
  const { data, isLoading } = useBlitzRouteMap();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [domain, setDomain] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setDomain(data.domain);
      setRows(Object.entries(data.mappings).map(([key, value]) => ({ key, value: String(value) })));
    }
  }, [data]);

  const updateRow = (i: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, { key: "", value: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const mappings: Record<string, string> = {};
      for (const r of rows) {
        if (r.key.trim()) mappings[r.key.trim()] = r.value.trim();
      }
      const { error } = await (blitzSupabase as any)
        .from(BLITZ_TABLES.routeConfig)
        .update({ domain, mappings })
        .eq("id", data.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["blitzleads", "route-config"] });
      toast({ title: "Configuração salva" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: e?.message ?? String(e) });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Domínio de acesso</h3>
          <p className="text-sm text-muted-foreground">Subdomínio que deve encaminhar para o módulo BlitzLeads.</p>
        </div>
        <div className="space-y-2 max-w-md">
          <Label htmlFor="blitz-domain">Domínio</Label>
          <Input id="blitz-domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="blitzleads.atendejulia.com.br" />
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold">De-para de rotas</h3>
            <p className="text-sm text-muted-foreground">Chave = caminho no subdomínio · Valor = rota interna (/BlitzLead/...)</p>
          </div>
          <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-4 h-4 mr-1" /> Adicionar</Button>
        </div>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
              <Input value={r.key} onChange={(e) => updateRow(i, { key: e.target.value })} placeholder="/" />
              <Input value={r.value} onChange={(e) => updateRow(i, { value: e.target.value })} placeholder="/BlitzLead/call-center" />
              <Button variant="ghost" size="icon" onClick={() => removeRow(i)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma rota configurada.</p>}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvando</>) : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}