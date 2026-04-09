import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { externalDb } from "@/lib/externalDb";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Users, Search, Phone } from "lucide-react";
import { toast } from "sonner";

interface TeamMember {
  id: string;
  phone: string;
  name: string;
  user_id?: number;
  email?: string;
  role?: string;
}

interface ExternalUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface SupportTeamConfigProps {
  onMembersChange?: (phones: string[]) => void;
}

export default function SupportTeamConfig({ onMembersChange }: SupportTeamConfigProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [externalUsers, setExternalUsers] = useState<ExternalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchAvailable, setSearchAvailable] = useState("");
  const [searchSelected, setSearchSelected] = useState("");
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState("");

  useEffect(() => {
    loadMembers();
    loadExternalUsers();
  }, []);

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("support_team_members")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setMembers(data || []);
      onMembersChange?.(data?.map((m: any) => m.phone).filter(Boolean) || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadExternalUsers = async () => {
    try {
      const users = await externalDb.getUsersWithPermissions();
      const filtered = users.filter(
        (u: any) => u.role === "admin" || u.role === "colaborador"
      );
      setExternalUsers(
        filtered.map((u: any) => ({
          id: u.id,
          name: u.name || u.email,
          email: u.email || "",
          role: u.role || "",
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar usuários externos:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const selectedUserIds = new Set(members.map((m) => m.user_id).filter(Boolean));

  const availableUsers = externalUsers.filter(
    (u) =>
      !selectedUserIds.has(u.id) &&
      (searchAvailable === "" ||
        u.name.toLowerCase().includes(searchAvailable.toLowerCase()) ||
        u.email.toLowerCase().includes(searchAvailable.toLowerCase()))
  );

  const filteredMembers = members.filter(
    (m) =>
      searchSelected === "" ||
      m.name.toLowerCase().includes(searchSelected.toLowerCase()) ||
      (m.email || "").toLowerCase().includes(searchSelected.toLowerCase())
  );

  const addUser = async (user: ExternalUser) => {
    // Optimistic
    const tempId = crypto.randomUUID();
    const newMember: TeamMember = {
      id: tempId,
      phone: "",
      name: user.name,
      user_id: user.id,
      email: user.email,
      role: user.role,
    };
    setMembers((prev) => [...prev, newMember]);

    try {
      const { data, error } = await supabase
        .from("support_team_members")
        .insert({
          phone: "",
          name: user.name,
          user_id: user.id,
          email: user.email,
          role: user.role,
        })
        .select("id")
        .single();
      if (error) throw error;
      setMembers((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, id: data.id } : m))
      );
      toast.success(`${user.name} adicionado`);
    } catch (err: any) {
      setMembers((prev) => prev.filter((m) => m.id !== tempId));
      toast.error("Erro ao adicionar", { description: err.message });
    }
  };

  const removeUser = async (member: TeamMember) => {
    setMembers((prev) => prev.filter((m) => m.id !== member.id));
    try {
      const { error } = await supabase
        .from("support_team_members")
        .delete()
        .eq("id", member.id);
      if (error) throw error;
      toast.success(`${member.name} removido`);
      onMembersChange?.(
        members
          .filter((m) => m.id !== member.id)
          .map((m) => m.phone)
          .filter(Boolean)
      );
    } catch (err: any) {
      loadMembers();
      toast.error("Erro ao remover", { description: err.message });
    }
  };

  const savePhone = async (member: TeamMember) => {
    const cleanPhone = phoneValue.replace(/\D/g, "");
    try {
      const { error } = await supabase
        .from("support_team_members")
        .update({ phone: cleanPhone })
        .eq("id", member.id);
      if (error) throw error;
      setMembers((prev) =>
        prev.map((m) => (m.id === member.id ? { ...m, phone: cleanPhone } : m))
      );
      setEditingPhone(null);
      toast.success("Telefone atualizado");
      onMembersChange?.(
        members.map((m) => (m.id === member.id ? cleanPhone : m.phone)).filter(Boolean)
      );
    } catch (err: any) {
      toast.error("Erro ao salvar telefone", { description: err.message });
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "admin") {
      return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Admin</Badge>;
    }
    return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">Colaborador</Badge>;
  };

  const isLoading = loading || loadingUsers;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Colaboradores Julia
        </CardTitle>
        <CardDescription>
          Selecione os usuários que atuam nos grupos de suporte para identificar mensagens
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Available */}
            <div className="border rounded-lg">
              <div className="p-3 border-b bg-muted/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Disponíveis</span>
                  <Badge variant="outline" className="text-xs">{availableUsers.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou email..."
                    value={searchAvailable}
                    onChange={(e) => setSearchAvailable(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {availableUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nenhum usuário disponível
                  </p>
                ) : (
                  availableUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-2.5 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate">{user.name}</span>
                            {getRoleBadge(user.role)}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate block">
                            {user.email}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-primary hover:bg-primary/10"
                        onClick={() => addUser(user)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Selected */}
            <div className="border rounded-lg border-primary/20">
              <div className="p-3 border-b bg-primary/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Selecionados</span>
                  <Badge className="text-xs">{members.length}</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar selecionados..."
                    value={searchSelected}
                    onChange={(e) => setSearchSelected(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {filteredMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Nenhum colaborador selecionado
                  </p>
                ) : (
                  filteredMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-2.5 hover:bg-muted/50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">{member.name}</span>
                              {member.role && getRoleBadge(member.role)}
                            </div>
                            <span className="text-[11px] text-muted-foreground truncate block">
                              {member.email}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 shrink-0 text-destructive hover:bg-destructive/10"
                          onClick={() => removeUser(member)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Inline phone */}
                      <div className="mt-1.5 ml-10">
                        {editingPhone === member.id ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              value={phoneValue}
                              onChange={(e) => setPhoneValue(e.target.value)}
                              placeholder="5511999999999"
                              className="h-6 text-xs w-40 font-mono"
                              onKeyDown={(e) => {
                                if (e.key === "Enter") savePhone(member);
                                if (e.key === "Escape") setEditingPhone(null);
                              }}
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2"
                              onClick={() => savePhone(member)}
                            >
                              OK
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            onClick={() => {
                              setEditingPhone(member.id);
                              setPhoneValue(member.phone || "");
                            }}
                          >
                            <Phone className="h-3 w-3" />
                            {member.phone ? (
                              <span className="font-mono">{member.phone}</span>
                            ) : (
                              <span className="italic">Adicionar telefone</span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
