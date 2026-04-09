import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Users, Shield, User } from "lucide-react";
import { toast } from "sonner";

interface SupportGroupsTabProps {
  apiUrl: string;
  instanceToken: string;
  teamPhones: string[];
}

interface GroupInfo {
  id: string;
  subject: string;
  size: number;
  pictureUrl?: string;
  participants: { id: string; admin?: string }[];
}

export default function SupportGroupsTab({ apiUrl, instanceToken, teamPhones }: SupportGroupsTabProps) {
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGroups();
  }, [apiUrl, instanceToken]);

  const fetchGroups = async () => {
    if (!apiUrl || !instanceToken) return;
    setLoading(true);
    try {
      const resp = await fetch(`${apiUrl}/group/list`, {
        method: "GET",
        headers: { token: instanceToken },
      });
      const data = await resp.json();
      const list: GroupInfo[] = Array.isArray(data) ? data : (data?.groups || data?.data || []);
      setGroups(list);
    } catch (err: any) {
      console.error(err);
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
              const teamMembers = participants.filter((p) => isTeamMember(p.id));
              const clients = participants.filter((p) => !isTeamMember(p.id));

              return (
                <AccordionItem key={group.id} value={group.id} className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={group.pictureUrl} />
                        <AvatarFallback>{(group.subject || "G")[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{group.subject || group.id}</p>
                        <p className="text-xs text-muted-foreground">{participants.length} participantes</p>
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
                              <div key={p.id} className="flex items-center gap-2 text-xs pl-4">
                                <Badge className="bg-blue-500/10 text-blue-600 text-xs">Suporte</Badge>
                                <span>{p.id.split("@")[0]}</span>
                                {p.admin && <Badge variant="outline" className="text-xs">{p.admin}</Badge>}
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
                            <div key={p.id} className="flex items-center gap-2 text-xs pl-4">
                              <Badge variant="secondary" className="text-xs">Cliente</Badge>
                              <span>{p.id.split("@")[0]}</span>
                              {p.admin && <Badge variant="outline" className="text-xs">{p.admin}</Badge>}
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
