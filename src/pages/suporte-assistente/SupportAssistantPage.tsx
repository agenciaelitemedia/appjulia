import { useState, useEffect, useCallback } from "react";
import { Headset, Wifi, WifiOff, Loader2, QrCode, Trash2, RefreshCw, AlertTriangle, Smartphone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SupportLogsTab from "./components/SupportLogsTab";
import SupportGroupsTab from "./components/SupportGroupsTab";
import SupportTeamConfig from "./components/SupportTeamConfig";

interface SupportConfig {
  id?: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  instance_token: string;
  connection_status: string;
}

export default function SupportAssistantPage() {
  const [config, setConfig] = useState<SupportConfig>({
    instance_name: "",
    api_url: "",
    api_key: "",
    instance_token: "",
    connection_status: "disconnected",
  });
  const [loading, setLoading] = useState(true);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [newInstanceName, setNewInstanceName] = useState("suporte-assistente");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteConfirmSwitch, setDeleteConfirmSwitch] = useState(false);
  const [teamPhones, setTeamPhones] = useState<string[]>([]);
  const [whatsappProfile, setWhatsappProfile] = useState<{
    profilePicUrl: string | null;
    pushName: string | null;
    phone: string | null;
    platform: string | null;
  } | null>(null);
  useEffect(() => {
    loadConfig();
  }, []);

  const fetchWhatsappProfile = useCallback(async (apiUrl: string, token: string) => {
    try {
      const [infoResp, statusResp] = await Promise.all([
        fetch(`${apiUrl}/instance/info`, { headers: { token } }).then(r => r.json()).catch(() => null),
        fetch(`${apiUrl}/instance/status`, { headers: { token } }).then(r => r.json()).catch(() => null),
      ]);

      const profilePicUrl = infoResp?.profilePicUrl || infoResp?.instance?.profilePicUrl || statusResp?.instance?.profilePicUrl || null;
      const pushName = infoResp?.pushName || infoResp?.profileName || infoResp?.instance?.profileName || infoResp?.instance?.name || statusResp?.instance?.profileName || null;
      const phone = infoResp?.instance?.owner || infoResp?.wid || statusResp?.status?.jid?.split(":")[0] || statusResp?.instance?.owner || null;
      const platform = infoResp?.platform || statusResp?.platform || null;

      setWhatsappProfile({ profilePicUrl, pushName, phone, platform });
    } catch (err) {
      console.error("Erro ao buscar perfil WhatsApp:", err);
    }
  }, []);

  const loadConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("support_assistant_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig({
          id: data.id,
          instance_name: data.instance_name || "",
          api_url: data.api_url || "",
          api_key: data.api_key || "",
          instance_token: data.instance_token || "",
          connection_status: data.connection_status || "disconnected",
        });
        // Fetch WhatsApp profile if connected
        if (data.connection_status === "connected" && data.api_url && data.instance_token) {
          fetchWhatsappProfile(data.api_url, data.instance_token);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar config:", err);
    } finally {
      setLoading(false);
    }
  };

  const isConfigured = !!(config.instance_name && config.instance_token && config.api_url);

  const createInstance = async () => {
    if (!newInstanceName.trim()) {
      toast.error("Digite um nome para a instância");
      return;
    }
    setCreatingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-admin", {
        body: {
          action: "create_instance_support",
          instanceName: newInstanceName.trim(),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao criar instância");

      const configData = {
        instance_name: data.instanceName,
        api_url: data.apiUrl,
        api_key: data.token,
        instance_token: data.token,
        connection_status: "disconnected",
        updated_at: new Date().toISOString(),
      };

      if (config.id) {
        await supabase
          .from("support_assistant_config")
          .update(configData)
          .eq("id", config.id);
      } else {
        const { data: inserted } = await supabase
          .from("support_assistant_config")
          .insert(configData)
          .select("id")
          .single();
        if (inserted) configData['id'] = inserted.id;
      }

      setConfig((prev) => ({ ...prev, ...configData, id: config.id || (configData as any).id }));
      toast.success("Instância criada com sucesso!", {
        description: `Instância "${data.instanceName}" pronta. Escaneie o QR Code para conectar.`,
      });

      setTimeout(() => fetchQrCode(data.apiUrl, data.token), 1000);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar instância", { description: err.message });
    } finally {
      setCreatingInstance(false);
    }
  };

  const openDeleteDialog = () => {
    setDeleteConfirmName("");
    setDeleteConfirmSwitch(false);
    setShowDeleteDialog(true);
  };

  const canConfirmDelete = deleteConfirmName === config.instance_name && deleteConfirmSwitch;

  const deleteInstance = async () => {
    if (!config.instance_name || !canConfirmDelete) return;
    setShowDeleteDialog(false);
    setDeletingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-admin", {
        body: {
          action: "delete_instance",
          instanceName: config.instance_name,
          instanceToken: config.instance_token,
        },
      });

      if (error) throw error;

      if (config.id) {
        await supabase
          .from("support_assistant_config")
          .update({
            instance_name: null,
            api_url: null,
            api_key: null,
            instance_token: null,
            connection_status: "disconnected",
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
      }

      setConfig((prev) => ({
        ...prev,
        instance_name: "",
        api_url: "",
        api_key: "",
        instance_token: "",
        connection_status: "disconnected",
      }));
      setQrCode(null);
      toast.success("Instância removida");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao remover instância", { description: err.message });
    } finally {
      setDeletingInstance(false);
    }
  };

  const fetchQrCode = useCallback(async (apiUrl?: string, token?: string) => {
    const url = apiUrl || config.api_url;
    const tk = token || config.instance_token;
    if (!url || !tk) {
      toast.error("Configure a instância primeiro");
      return;
    }
    setCheckingStatus(true);
    try {
      const statusResp = await fetch(`${url}/instance/status`, {
        headers: { token: tk },
      });
      const statusData = await statusResp.json();

      if (statusData?.status?.connected && statusData?.status?.loggedIn) {
        setQrCode(null);
        setConfig((prev) => ({ ...prev, connection_status: "connected" }));
        if (config.id) {
          await supabase
            .from("support_assistant_config")
            .update({ connection_status: "connected", updated_at: new Date().toISOString() })
            .eq("id", config.id);
        }
        toast.success("WhatsApp conectado!");
        return;
      }

      if (statusData?.instance?.qrcode) {
        const qr = statusData.instance.qrcode;
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
        return;
      }

      await fetch(`${url}/instance/connect`, {
        method: "POST",
        headers: { token: tk, "Content-Type": "application/json" },
      });

      await new Promise((r) => setTimeout(r, 2000));
      const statusResp2 = await fetch(`${url}/instance/status`, {
        headers: { token: tk },
      });
      const statusData2 = await statusResp2.json();

      if (statusData2?.instance?.qrcode) {
        const qr = statusData2.instance.qrcode;
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
      } else {
        toast.info("QR Code ainda não disponível. Clique novamente em alguns segundos.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao buscar QR Code", { description: err.message });
    } finally {
      setCheckingStatus(false);
    }
  }, [config.api_url, config.instance_token, config.id]);

  const checkStatus = async () => {
    if (!config.api_url || !config.instance_token) return;
    setCheckingStatus(true);
    try {
      const response = await fetch(`${config.api_url}/instance/status`, {
        headers: { token: config.instance_token },
      });
      const data = await response.json();
      const connected = data?.status === "open" || data?.state === "open";
      const newStatus = connected ? "connected" : "disconnected";

      setConfig((prev) => ({ ...prev, connection_status: newStatus }));
      if (config.id) {
        await supabase
          .from("support_assistant_config")
          .update({ connection_status: newStatus, updated_at: new Date().toISOString() })
          .eq("id", config.id);
      }

      if (connected) {
        setQrCode(null);
        toast.success("WhatsApp conectado!");
      } else {
        toast.info("WhatsApp desconectado");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao verificar status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const webhookUrl = config.instance_name
    ? `https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/support-assistant-webhook?instance=${encodeURIComponent(config.instance_name)}`
    : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Headset className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Assistente de Suporte</h1>
          <p className="text-muted-foreground text-sm">
            Configure a conexão WhatsApp para monitoramento de grupos
          </p>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuração</TabsTrigger>
          {isConfigured && <TabsTrigger value="logs">Logs</TabsTrigger>}
          {isConfigured && <TabsTrigger value="groups">Grupos</TabsTrigger>}
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-4">
          {/* Status */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Status da Conexão
                    <Badge variant={config.connection_status === "connected" ? "default" : "secondary"}>
                      {config.connection_status === "connected" ? (
                        <><Wifi className="h-3 w-3 mr-1" /> Conectado</>
                      ) : (
                        <><WifiOff className="h-3 w-3 mr-1" /> Desconectado</>
                      )}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {isConfigured
                      ? `Instância: ${config.instance_name}`
                      : "Crie uma instância UaZapi para conectar o WhatsApp da assistente"}
                  </CardDescription>
                </div>
                {isConfigured && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={checkStatus} disabled={checkingStatus}>
                      {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button variant="destructive" size="sm" onClick={openDeleteDialog} disabled={deletingInstance}>
                      {deletingInstance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* Criar instância */}
          {!isConfigured && (
            <Card>
              <CardHeader>
                <CardTitle>Criar Instância UaZapi</CardTitle>
                <CardDescription>
                  Será criada uma instância usando as credenciais UaZapi já configuradas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 max-w-md">
                  <Label>Nome da Instância</Label>
                  <Input
                    placeholder="suporte-assistente"
                    value={newInstanceName}
                    onChange={(e) => setNewInstanceName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Identificador único para a instância WhatsApp do assistente
                  </p>
                </div>
                <Button onClick={createInstance} disabled={creatingInstance}>
                  {creatingInstance && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Criar Instância
                </Button>
              </CardContent>
            </Card>
          )}

          {/* QR Code */}
          {isConfigured && config.connection_status !== "connected" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  Conectar WhatsApp
                </CardTitle>
                <CardDescription>
                  Escaneie o QR Code com o WhatsApp da assistente de suporte
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {qrCode ? (
                  <div className="flex flex-col items-center gap-4">
                    <img src={qrCode} alt="QR Code WhatsApp" className="max-w-xs rounded-lg border" />
                    <p className="text-sm text-muted-foreground">
                      Abra o WhatsApp &gt; Dispositivos conectados &gt; Conectar dispositivo
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => fetchQrCode()} disabled={checkingStatus}>
                        {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Atualizar QR Code
                      </Button>
                      <Button onClick={checkStatus} disabled={checkingStatus}>
                        Verificar Conexão
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => fetchQrCode()} disabled={checkingStatus}>
                    {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                    Obter QR Code
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Webhook */}
          {isConfigured && (
            <Card>
              <CardHeader>
                <CardTitle>Webhook</CardTitle>
                <CardDescription>URL configurada automaticamente para receber mensagens de grupos</CardDescription>
              </CardHeader>
              <CardContent>
                <code className="block p-3 bg-muted rounded text-xs break-all">{webhookUrl}</code>
              </CardContent>
            </Card>
          )}

          {/* Team Config */}
          <SupportTeamConfig onMembersChange={setTeamPhones} />
        </TabsContent>

        {isConfigured && (
          <TabsContent value="logs" className="mt-4">
            <SupportLogsTab teamPhones={teamPhones} />
          </TabsContent>
        )}

        {isConfigured && (
          <TabsContent value="groups" className="mt-4">
            <SupportGroupsTab
              apiUrl={config.api_url}
              instanceToken={config.instance_token}
              teamPhones={teamPhones}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Excluir Conexão
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Esta ação é <strong>irreversível</strong>. A instância será removida permanentemente.
                </p>
                <div className="space-y-2">
                  <Label>
                    Digite o nome da conexão para confirmar: <strong>{config.instance_name}</strong>
                  </Label>
                  <Input
                    placeholder={config.instance_name}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <Label htmlFor="delete-switch" className="text-sm cursor-pointer">
                    Confirmo que desejo excluir esta conexão
                  </Label>
                  <Switch
                    id="delete-switch"
                    checked={deleteConfirmSwitch}
                    onCheckedChange={setDeleteConfirmSwitch}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={deleteInstance}
              disabled={!canConfirmDelete || deletingInstance}
            >
              {deletingInstance && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir Conexão
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
