import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, PhoneIncoming, PhoneOutgoing, Mic, Clock } from "lucide-react";
import { useChatCallLogs, useCreateCallLog } from "@/hooks/useChatCallLogs";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const STATUS_COLORS: Record<string, string> = {
  initiated: "bg-blue-500",
  ringing: "bg-yellow-500",
  answered: "bg-green-500",
  completed: "bg-emerald-600",
  missed: "bg-red-500",
  failed: "bg-destructive",
  busy: "bg-orange-500",
};

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export default function ChatTelephonyPage() {
  const { user } = useAuth();
  const clientId = (user as any)?.cod_agent || (user as any)?.id || "default";
  const { data: logs = [], isLoading } = useChatCallLogs({ clientId });
  const createCall = useCreateCallLog();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ to_number: "", direction: "outbound", notes: "" });

  const totalDur = logs.reduce((a, l) => a + (l.duration_seconds || 0), 0);
  const answered = logs.filter((l) => l.status === "answered" || l.status === "completed").length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-7 w-7 text-primary" />
            Telefonia no Chat
          </h1>
          <p className="text-muted-foreground">Histórico de chamadas vinculadas às conversas</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Phone className="h-4 w-4 mr-2" />Registrar chamada</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova chamada</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Número destino" value={form.to_number} onChange={(e) => setForm({ ...form, to_number: e.target.value })} />
              <select className="w-full border rounded-md p-2 bg-background" value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}>
                <option value="outbound">Saída</option>
                <option value="inbound">Entrada</option>
              </select>
              <Textarea placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button className="w-full" onClick={async () => {
                await createCall.mutateAsync({ client_id: clientId, ...form, status: "initiated" } as any);
                setOpen(false); setForm({ to_number: "", direction: "outbound", notes: "" });
              }}>Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Total de chamadas</div><div className="text-2xl font-bold">{logs.length}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Atendidas</div><div className="text-2xl font-bold text-emerald-600">{answered}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Tempo total</div><div className="text-2xl font-bold">{fmtDuration(totalDur)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Taxa atendimento</div><div className="text-2xl font-bold">{logs.length ? Math.round((answered / logs.length) * 100) : 0}%</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Nenhuma chamada registrada ainda</div>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
                  <div className="rounded-full bg-primary/10 p-2">
                    {l.direction === "inbound" ? <PhoneIncoming className="h-4 w-4 text-primary" /> : <PhoneOutgoing className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{l.to_number || l.from_number || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(l.started_at), "dd/MM/yy HH:mm", { locale: ptBR })} · {formatDistanceToNow(new Date(l.started_at), { locale: ptBR, addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-3 w-3" />
                    {fmtDuration(l.duration_seconds || 0)}
                  </div>
                  {l.recording_url && <Mic className="h-4 w-4 text-emerald-600" />}
                  <Badge className={STATUS_COLORS[l.status] || "bg-muted"}>{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
