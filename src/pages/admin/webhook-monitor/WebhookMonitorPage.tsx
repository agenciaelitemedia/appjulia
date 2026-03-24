import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Play, Pause, RefreshCw, Radio, Search } from "lucide-react";
import { format } from "date-fns";

interface WebhookLog {
  id: string;
  from: string;
  message: string;
  timestamp: string;
  cod_agent: string | null;
  forwarded: boolean;
  payload: unknown;
}

export default function WebhookMonitorPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-webhook", {
        body: { action: "get_logs" },
      });
      if (!error && data?.logs) {
        setLogs(data.logs.reverse());
      }
    } catch (err) {
      console.error("Erro ao buscar logs:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [isPolling, fetchLogs]);

  const filtered = logs.filter((log) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      log.from?.toLowerCase().includes(q) ||
      log.message?.toLowerCase().includes(q) ||
      log.cod_agent?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Webhook Monitor</h1>
          <Badge
            variant={isPolling ? "default" : "secondary"}
            className={isPolling ? "animate-pulse" : ""}
          >
            <Radio className="w-3 h-3 mr-1" />
            {isPolling ? "Ao vivo" : "Pausado"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{logs.length} logs</Badge>
          <Button variant="outline" size="icon" onClick={fetchLogs} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsPolling(!isPolling)}
          >
            {isPolling ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Mensagens Recebidas</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por número, mensagem..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">Timestamp</TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {logs.length === 0
                        ? "Nenhum log recebido ainda. Aguardando mensagens..."
                        : "Nenhum resultado para o filtro."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => (
                    <TableRow
                      key={log.id}
                      className={
                        log.forwarded
                          ? "bg-green-500/5 hover:bg-green-500/10"
                          : "bg-yellow-500/5 hover:bg-yellow-500/10"
                      }
                    >
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {format(new Date(log.timestamp), "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.from}</TableCell>
                      <TableCell className="max-w-[300px] truncate text-sm">
                        {log.message}
                      </TableCell>
                      <TableCell>
                        {log.cod_agent ? (
                          <Badge variant="outline" className="text-xs">{log.cod_agent}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={log.forwarded ? "default" : "secondary"} className="text-xs">
                          {log.forwarded ? "Enviado" : "Não enviado"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
