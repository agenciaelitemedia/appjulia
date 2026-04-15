import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Send, Save, RefreshCw, Bell, BellRing, Loader2 } from "lucide-react";

export default function PushNotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["push-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("push_notifications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: subscriptionCount } = useQuery({
    queryKey: ["push-subscriptions-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("push_subscriptions")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count || 0;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { notificationId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Enviado! ${data.sent} entregues, ${data.errors} erros`);
      queryClient.invalidateQueries({ queryKey: ["push-notifications"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao enviar: " + err.message);
    },
  });

  const saveDraft = async () => {
    if (!title || !body) {
      toast.error("Título e corpo são obrigatórios");
      return;
    }
    const { error } = await supabase.from("push_notifications").insert({
      title,
      body,
      url: url || null,
      icon: icon || null,
      target_type: targetType,
      target_value: targetValue || null,
      status: "draft",
      created_by: user?.id || null,
    });
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Rascunho salvo!");
    resetForm();
    queryClient.invalidateQueries({ queryKey: ["push-notifications"] });
  };

  const sendNow = async () => {
    if (!title || !body) {
      toast.error("Título e corpo são obrigatórios");
      return;
    }
    const { data: notif, error } = await supabase
      .from("push_notifications")
      .insert({
        title,
        body,
        url: url || null,
        icon: icon || null,
        target_type: targetType,
        target_value: targetValue || null,
        status: "draft",
        created_by: user?.id || null,
      })
      .select()
      .single();
    if (error || !notif) {
      toast.error("Erro ao criar notificação");
      return;
    }
    sendMutation.mutate(notif.id);
    resetForm();
  };

  const resetForm = () => {
    setTitle("");
    setBody("");
    setUrl("");
    setIcon("");
    setTargetType("all");
    setTargetValue("");
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "sent": return "default";
      case "sending": return "secondary";
      case "draft": return "outline";
      default: return "outline";
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "sent": return "Enviado";
      case "sending": return "Enviando...";
      case "draft": return "Rascunho";
      default: return status;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BellRing className="h-6 w-6" />
            Notificações Push
          </h1>
          <p className="text-muted-foreground mt-1">
            {subscriptionCount ?? 0} dispositivo(s) registrado(s)
          </p>
        </div>
      </div>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Criar Notificação</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <CardTitle>Nova Notificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título da notificação"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL (opcional)</Label>
                  <Input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="/dashboard ou https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Corpo *</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Texto da notificação"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Ícone (opcional)</Label>
                  <Input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="URL do ícone"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Enviar para</Label>
                  <Select value={targetType} onValueChange={setTargetType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="role">Por Role</SelectItem>
                      <SelectItem value="user">Por Usuário (ID)</SelectItem>
                      <SelectItem value="cod_agent">Por Agente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {targetType !== "all" && (
                  <div className="space-y-2">
                    <Label>
                      {targetType === "role" ? "Role" : targetType === "user" ? "ID do Usuário" : "Cód. Agente"}
                    </Label>
                    {targetType === "role" ? (
                      <Select value={targetValue} onValueChange={setTargetValue}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">Usuário</SelectItem>
                          <SelectItem value="time">Time</SelectItem>
                          <SelectItem value="advogado">Advogado</SelectItem>
                          <SelectItem value="comercial">Comercial</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder={targetType === "user" ? "Ex: 123" : "Ex: ag_001"}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={sendNow} disabled={sendMutation.isPending}>
                  {sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Enviar Agora
                </Button>
                <Button variant="outline" onClick={saveDraft}>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Rascunho
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Notificações</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : !notifications?.length ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma notificação criada ainda.</p>
              ) : (
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{n.title}</span>
                          <Badge variant={statusColor(n.status || "draft")}>
                            {statusLabel(n.status || "draft")}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 truncate">{n.body}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Para: {n.target_type === "all" ? "Todos" : `${n.target_type}: ${n.target_value}`}</span>
                          {n.sent_at && <span>Enviado: {new Date(n.sent_at).toLocaleString("pt-BR")}</span>}
                          {(n.sent_count || 0) > 0 && <span>✓ {n.sent_count}</span>}
                          {(n.error_count || 0) > 0 && <span className="text-destructive">✗ {n.error_count}</span>}
                        </div>
                      </div>
                      {(n.status === "draft" || n.status === "sent") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => sendMutation.mutate(n.id)}
                          disabled={sendMutation.isPending}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {n.status === "draft" ? "Enviar" : "Reenviar"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
