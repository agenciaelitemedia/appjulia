import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Users, Shield, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SupportGroupsTabProps {
  apiUrl: string;
  instanceToken: string;
  teamPhones: string[];
}

interface GroupParticipant {
  jid: string;
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

export default function SupportGroupsTab({ apiUrl, instanceToken, teamPhones }: SupportGroupsTabProps) {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, [apiUrl, instanceToken]);

  const normalizeGroup = (g: any): GroupInfo => {
    const participants = (g.Participants || g.participants || []).map((p: any) => ({
      jid: (p.JID || p.jid || p.id || "") as string,
      isAdmin: !!(p.IsAdmin || p.isAdmin || p.admin === "admin" || p.admin === "superadmin"),
      isSuperAdmin: !!(p.IsSuperAdmin || p.isSuperAdmin || p.admin === "superadmin"),
    }));
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
      // Use GET /group/list — the correct UaZapi endpoint
      const { data: proxyData, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: {
          method: "GET",
          endpoint: "/group/list",
          token: instanceToken,
          baseUrl: apiUrl,
        },
      });

      console.log("[SupportGroupsTab] /group/list raw response:", proxyData);

      let rawList: any[] = [];
      if (!error && proxyData?.ok) {
        rawList = extractArray(proxyData.data);
      } else {
        console.warn("[SupportGroupsTab] /group/list failed, error:", error, "proxyData:", proxyData);
      }

      const list = rawList.map(normalizeGroup).filter(g => g.jid);
      console.log("[SupportGroupsTab] Normalized groups:", list.length, list.slice(0, 2));
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

  const isTeamMember = (jid: string) => {
    const phone = jid.split("@")[0];
    return teamPhones.some((tp) => phone.includes(tp) || tp.includes(phone));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Grupos ({groups.length})
            </CardTitle>
            <CardDescription>Grupos do WhatsApp conectado ao assistente</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchGroups} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhum grupo encontrado</p>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {groups.map((group) => {
              const participants = group.participants || [];
              const teamMembers = participants.filter((p) => isTeamMember(p.jid));
              const clients = participants.filter((p) => !isTeamMember(p.jid));

              return (
                <AccordionItem key={group.jid} value={group.jid} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={group.pictureUrl} />
                        <AvatarFallback>{(group.name || "G")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{group.name || group.jid}</p>
                        <p className="text-xs text-muted-foreground">{group.size || participants.length} participantes</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {teamMembers.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-blue-600 flex items-center gap-1 mb-2">
                            <Shield className="h-3 w-3" /> Colaboradores Julia ({teamMembers.length})
                          </p>
                          <div className="space-y-1">
                            {teamMembers.map((p) => (
                              <div key={p.jid} className="flex items-center gap-2 text-xs pl-4">
                                <Badge className="bg-blue-500/10 text-blue-600 text-xs">Suporte</Badge>
                                <span>{p.jid.split("@")[0]}</span>
                                {p.isAdmin && <Badge variant="outline" className="text-xs">Admin</Badge>}
                                {p.isSuperAdmin && <Badge variant="outline" className="text-xs">Super Admin</Badge>}
                              </div>
                            ))}
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
                              <span>{p.jid.split("@")[0]}</span>
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
