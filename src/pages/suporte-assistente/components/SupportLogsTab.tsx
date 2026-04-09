import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, ChevronRight, Search, RefreshCw } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;

interface SupportLogsTabProps {
  teamPhones: string[];
}

export default function SupportLogsTab({ teamPhones }: SupportLogsTabProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadMessages();
  }, [page, search]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("support_group_messages")
        .select("*", { count: "exact" })
        .order("timestamp", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (search.trim()) {
        query = query.or(`message_text.ilike.%${search}%,sender_name.ilike.%${search}%,group_name.ilike.%${search}%`);
      }

      const { data, count, error } = await query;
      if (error) throw error;
      setMessages(data || []);
      setTotal(count || 0);
    } catch (err) {
      console.error("Erro ao carregar logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const isTeamMember = (senderJid: string | null) => {
    if (!senderJid) return false;
    const phone = senderJid.split("@")[0];
    return teamPhones.some((tp) => phone.includes(tp) || tp.includes(phone));
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mensagens de Grupos ({total})</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadMessages()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar mensagem, remetente..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-8"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Nenhuma mensagem encontrada</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4">Data/Hora</th>
                    <th className="pb-2 pr-4">Grupo</th>
                    <th className="pb-2 pr-4">Remetente</th>
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Origem</th>
                    <th className="pb-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((msg) => (
                    <tr key={msg.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap text-xs text-muted-foreground">
                        {msg.timestamp ? format(new Date(msg.timestamp), "dd/MM HH:mm") : "-"}
                      </td>
                      <td className="py-2 pr-4 text-xs max-w-[120px] truncate">{msg.group_name || "-"}</td>
                      <td className="py-2 pr-4 text-xs max-w-[120px] truncate">{msg.sender_name || msg.sender_jid?.split("@")[0] || "-"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{msg.message_type || "text"}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {isTeamMember(msg.sender_jid) ? (
                          <Badge className="bg-blue-500/10 text-blue-600 text-xs">Suporte</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Cliente</Badge>
                        )}
                      </td>
                      <td className="py-2 text-xs max-w-[250px] truncate">{msg.message_text || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                Página {page + 1} de {totalPages || 1}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
