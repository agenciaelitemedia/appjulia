import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, Users, Shield, User, Search, Eye, EyeOff, MonitorCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SupportGroupsTabProps {
  apiUrl: string;
  instanceToken: string;
  teamPhones: string[];
}

interface GroupParticipant {
  jid: string;
  phoneNumber: string;
  displayName: string;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}

interface GroupInfo {
  jid: string;
  name: string;
  size: number;
  pictureUrl?: string;
  participants: GroupParticipant[];
  owner?: string;
  description?: string;
  isLocked?: boolean;
  isAnnounce?: boolean;
}

interface TeamMemberRecord {
  phone: string;
  name: string;
}

interface MonitoredGroup {
  group_jid: string;
  group_name: string;
  is_active: boolean;
}

export default function SupportGroupsTab({ apiUrl, instanceToken }: SupportGroupsTabProps) {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);
  const [monitoredJids, setMonitoredJids] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [togglingJid, setTogglingJid] = useState<string | null>(null);
  const [monitoringAll, setMonitoringAll] = useState(false);

  useEffect(() => {
    loadTeamMembers();
    loadMonitoredGroups();
  }, []);

  useEffect(() => {
    if (apiUrl && instanceToken) fetchGroups();
  }, [apiUrl, instanceToken]);

  const loadTeamMembers = async () => {
    const { data } = await supabase
      .from("support_team_members")
      .select("phone, name");
    setTeamMembers(
      (data || [])
        .filter((m: any) => m.phone && m.phone.trim() !== "")
        .map((m: any) => ({ phone: m.phone, name: m.name }))
    );
  };

  const loadMonitoredGroups = async () => {
    const { data } = await supabase
      .from("support_monitored_groups")
      .select("group_jid")
      .eq("is_active", true);
    setMonitoredJids(new Set((data || []).map((g: any) => g.group_jid)));
  };

  const normalizeGroup = (g: any): GroupInfo => {
    const participants = (g.Participants || g.participants || []).map((p: any) => {
      const phoneRaw = (p.PhoneNumber || p.phoneNumber || "") as string;
      const phone = phoneRaw.split("@")[0];
      return {
        jid: (p.JID || p.jid || p.id || "") as string,
        phoneNumber: phone,
        displayName: (p.DisplayName || p.displayName || "") as string,
        isAdmin: !!(p.IsAdmin || p.isAdmin || p.admin === "admin" || p.admin === "superadmin"),
        isSuperAdmin: !!(p.IsSuperAdmin || p.isSuperAdmin || p.admin === "superadmin"),
      };
    });
    return {
      jid: (g.JID || g.jid || g.id || g.groupId || "") as string,
      name: (g.Name || g.name || g.subject || g.groupName || "") as string,
      size: (g.Size || g.size || participants.length || 0) as number,
      pictureUrl: (g.ProfilePictureUrl || g.pictureUrl || g.profilePictureUrl || g.imgUrl || g.picture || null) as string | undefined,
      participants,
      owner: (g.OwnerJID || g.owner || "") as string,
      description: (g.Description || g.description || g.desc || "") as string,
      isLocked: !!(g.IsLocked || g.isLocked || g.restrict),
      isAnnounce: !!(g.IsAnnounce || g.isAnnounce || g.announce),
    };
  };

  const extractArray = (data: any): any[] => {
    if (Array.isArray(data)) return data;
    if (data && typeof data === "object") {
      if (Array.isArray(data.groups)) return data.groups;
      if (Array.isArray(data.data)) return data.data;
    }
    return [];
  };

  const fetchGroups = async () => {
    if (!apiUrl || !instanceToken) return;
    setLoading(true);
    try {
      const { data: proxyData, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: {
          method: "GET",
          endpoint: "/group/list",
          token: instanceToken,
          baseUrl: apiUrl,
        },
      });

      let rawList: any[] = [];
      if (!error && proxyData?.ok) {
        rawList = extractArray(proxyData.data);
      }

      const list = rawList.map(normalizeGroup).filter(g => g.jid);
      setGroups(list);

      if (list.length === 0) {
        toast.info("Nenhum grupo encontrado nesta instância");
      }
    } catch (err: any) {
      console.error("[SupportGroupsTab] Error:", err);
      toast.error("Erro ao carregar grupos", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const toggleMonitoring = async (group: GroupInfo) => {
    setTogglingJid(group.jid);
    const isMonitored = monitoredJids.has(group.jid);

    try {
      if (isMonitored) {
        const { error } = await supabase
          .from("support_monitored_groups")
          .delete()
          .eq("group_jid", group.jid);
        if (error) throw error;
        setMonitoredJids(prev => { const next = new Set(prev); next.delete(group.jid); return next; });
        toast.success(`"${group.name}" removido do monitoramento`);
      } else {
        const { error } = await supabase
          .from("support_monitored_groups")
          .upsert({
            group_jid: group.jid,
            group_name: group.name,
            picture_url: group.pictureUrl || null,
            is_active: true,
            auto_added: false,
          }, { onConflict: "group_jid" });
        if (error) throw error;
        setMonitoredJids(prev => new Set(prev).add(group.jid));
        toast.success(`"${group.name}" adicionado ao monitoramento`);
      }
    } catch (err: any) {
      toast.error("Erro ao alterar monitoramento", { description: err.message });
    } finally {
      setTogglingJid(null);
    }
  };

  const monitorAll = async () => {
    setMonitoringAll(true);
    try {
      const rows = groups.map(g => ({
        group_jid: g.jid,
        group_name: g.name,
        picture_url: g.pictureUrl || null,
        is_active: true,
        auto_added: false,
      }));
      const { error } = await supabase
        .from("support_monitored_groups")
        .upsert(rows, { onConflict: "group_jid" });
      if (error) throw error;
      setMonitoredJids(new Set(groups.map(g => g.jid)));
      toast.success(`${groups.length} grupos adicionados ao monitoramento`);
    } catch (err: any) {
      toast.error("Erro ao monitorar todos", { description: err.message });
    } finally {
      setMonitoringAll(false);
    }
  };

  const findTeamMember = (participant: GroupParticipant): TeamMemberRecord | undefined => {
    if (!participant.phoneNumber) return undefined;
    return teamMembers.find(
      (tm) => participant.phoneNumber.includes(tm.phone) || tm.phone.includes(participant.phoneNumber)
    );
  };

  const isTeamMember = (p: GroupParticipant) => !!findTeamMember(p);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const term = searchTerm.toLowerCase();
    return groups.filter(g => g.name.toLowerCase().includes(term) || g.jid.includes(term));
  }, [groups, searchTerm]);

  const monitoredCount = groups.filter(g => monitoredJids.has(g.jid)).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Grupos ({groups.length})
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              Grupos do WhatsApp conectado ao assistente
              {groups.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  <Eye className="h-3 w-3 mr-1" />
                  {monitoredCount} monitorados
                </Badge>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={monitorAll}
              disabled={loading || monitoringAll || groups.length === 0}
            >
              {monitoringAll ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <MonitorCheck className="h-4 w-4 mr-1" />}
              Monitorar Todos
            </Button>
            <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        {groups.length > 0 && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar grupo por nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            {searchTerm ? "Nenhum grupo encontrado com esse filtro" : "Nenhum grupo encontrado"}
          </p>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {filteredGroups.map((group) => {
              const participants = group.participants || [];
              const team = participants.filter((p) => isTeamMember(p));
              const clients = participants.filter((p) => !isTeamMember(p));
              const isMonitored = monitoredJids.has(group.jid);
              const isToggling = togglingJid === group.jid;

              return (
                <AccordionItem key={group.jid} value={group.jid} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left w-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={group.pictureUrl} />
                        <AvatarFallback>{(group.name || "G")[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{group.name || group.jid}</p>
                          {isMonitored && (
                            <Badge className="bg-green-500/10 text-green-600 border-green-200 text-[10px] px-1.5 py-0 shrink-0">
                              <Eye className="h-2.5 w-2.5 mr-0.5" />
                              Monitorando
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{group.size || participants.length} participantes</span>
                          {team.length > 0 && (
                            <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">
                              {team.length} colaborador{team.length > 1 ? "es" : ""}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`shrink-0 h-8 w-8 ${isMonitored ? "text-green-600 hover:text-red-600" : "text-muted-foreground hover:text-green-600"}`}
                        onClick={(e) => { e.stopPropagation(); toggleMonitoring(group); }}
                        disabled={isToggling}
                      >
                        {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : isMonitored ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {team.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-600 flex items-center gap-1 mb-2">
                            <Shield className="h-3 w-3" /> Colaboradores Julia ({team.length})
                          </p>
                          <div className="space-y-1">
                            {team.map((p) => {
                              const member = findTeamMember(p);
                              return (
                                <div key={p.jid} className="flex items-center gap-2 text-xs pl-4">
                                  <Badge className="bg-blue-500/10 text-blue-600 text-xs">Suporte</Badge>
                                  <span className="font-medium">{member?.name || p.phoneNumber || p.displayName || p.jid.split("@")[0]}</span>
                                  <span className="text-muted-foreground">{p.phoneNumber || p.jid.split("@")[0]}</span>
                                  {p.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                                  {p.isSuperAdmin && <Badge variant="outline" className="text-xs">Super Admin</Badge>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1 mb-2">
                          <User className="h-3 w-3" /> Clientes ({clients.length})
                        </p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {clients.map((p) => (
                            <div key={p.jid} className="flex items-center gap-2 text-xs pl-4">
                              <Badge variant="secondary" className="text-xs">Cliente</Badge>
                              <span>{p.phoneNumber || p.displayName || p.jid.split("@")[0]}</span>
                              {p.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
