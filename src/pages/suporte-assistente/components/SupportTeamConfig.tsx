import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  phone: string;
  name: string;
}

interface SupportTeamConfigProps {
  onMembersChange?: (phones: string[]) => void;
}

export default function SupportTeamConfig({ onMembersChange }: SupportTeamConfigProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("support_team_members")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMembers(data || []);
      onMembersChange?.(data?.map((m) => m.phone) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addMember = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      toast.error("Informe o número de telefone");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("support_team_members")
        .insert({ phone: cleanPhone, name: name.trim() });
      if (error) {
        if (error.code === "23505") {
          toast.error("Número já cadastrado");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Colaborador adicionado");
      setPhone("");
      setName("");
      loadMembers();
    } catch (err: any) {
      toast.error("Erro ao adicionar", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (id: string) => {
    try {
      const { error } = await supabase.from("support_team_members").delete().eq("id", id);
      if (error) throw error;
      toast.success("Colaborador removido");
      loadMembers();
    } catch (err: any) {
      toast.error("Erro ao remover", { description: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Colaboradores Julia
        </CardTitle>
        <CardDescription>
          Números dos colaboradores para identificar mensagens de suporte vs cliente nos grupos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 items-end">
          <div className="space-y-1 flex-1 max-w-[200px]">
            <Label className="text-xs">Telefone</Label>
            <Input
              placeholder="5511999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1 flex-1 max-w-[200px]">
            <Label className="text-xs">Nome</Label>
            <Input
              placeholder="Nome do colaborador"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button onClick={addMember} disabled={saving} size="sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Adicionar
          </Button>
        </div>

        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum colaborador cadastrado</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2 rounded border">
                <div className="flex items-center gap-2">
                  <Badge className="bg-blue-500/10 text-blue-600 text-xs">Suporte</Badge>
                  <span className="text-sm font-mono">{m.phone}</span>
                  {m.name && <span className="text-sm text-muted-foreground">— {m.name}</span>}
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeMember(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
