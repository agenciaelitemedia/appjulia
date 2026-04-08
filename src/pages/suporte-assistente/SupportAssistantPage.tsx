import { useState, useEffect } from "react";
import { Headset, Wifi, WifiOff, Loader2, QrCode, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SupportConfig {
  id?: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  instance_token: string;
  connection_status: string;
}

export default function SupportAssistantPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState<SupportConfig>({
    instance_name: "",
    api_url: "",
    api_key: "",
    instance_token: "",
    connection_status: "disconnected",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    loadConfig();
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
      }
    } catch (err) {
      console.error("Erro ao carregar config:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("support_assistant_config")
          .update({
            instance_name: config.instance_name,
            api_url: config.api_url,
            api_key: config.api_key,
            instance_token: config.instance_token,
            updated_at: new Date().toISOString(),
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("support_assistant_config")
          .insert({
            instance_name: config.instance_name,
            api_url: config.api_url,
            api_key: config.api_key,
            instance_token: config.instance_token,
          })
          .select("id")
          .single();
        if (error) throw error;
        setConfig((prev) => ({ ...prev, id: data.id }));
      }
      toast({ title: "Configuração salva com sucesso" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const createInstance = async () => {
    if (!config.api_url || !config.api_key || !config.instance_name) {
      toast({ title: "Preencha URL, API Key e Nome da Instância", variant: "destructive" });
      return;
    }
    setCreatingInstance(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: {
          action: "createInstance",
          baseUrl: config.api_url,
          apiKey: config.api_key,
          instanceName: config.instance_name,
        },
      });
      if (error) throw error;

      const token = data?.instance?.token || data?.token || "";
      if (token) {
        setConfig((prev) => ({ ...prev, instance_token: token }));
        await supabase
          .from("support_assistant_config")
          .update({ instance_token: token, updated_at: new Date().toISOString() })
          .eq("id", config.id);
      }

      toast({ title: "Instância criada com sucesso" });
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao criar instância", variant: "destructive" });
    } finally {
      setCreatingInstance(false);
    }
  };

  const fetchQrCode = async () => {
    if (!config.api_url || !config.instance_token || !config.instance_name) {
      toast({ title: "Configure a instância primeiro", variant: "destructive" });
      return;
    }
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("uazapi-proxy", {
        body: {
          action: "getQrCode",
          baseUrl: config.api_url,
          apiKey: config.instance_token,
          instanceName: config.instance_name,
        },
      });
      if (error) throw error;

      if (data?.qrcode) {
        setQrCode(data.qrcode);
      } else if (data?.instance?.state === "open" || data?.state === "open") {
        setQrCode(null);
        setConfig((prev) => ({ ...prev, connection_status: "connected" }));
        await supabase
          .from("support_assistant_config")
          .update({ connection_status: "connected", updated_at: new Date().toISOString() })
          .eq("id", config.id);
        toast({ title: "WhatsApp conectado!" });
      } else {
        toast({ title: "QR Code não disponível. Tente novamente.", variant: "destructive" });
      }
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao buscar QR Code", variant: "destructive" });
    } finally {
      setCheckingStatus(false);
    }
  };

  const webhookUrl = `https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/support-assistant-webhook?instance=${encodeURIComponent(config.instance_name)}`;

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
        </TabsList>

        <TabsContent value="config" className="space-y-6 mt-4">
          {/* Status */}
          <Card>
            <CardHeader>
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
              <CardDescription>
                Conecte um WhatsApp dedicado para a assistente de suporte
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Configuração UaZapi */}
          <Card>
            <CardHeader>
              <CardTitle>Credenciais UaZapi</CardTitle>
              <CardDescription>
                Configure a URL da API, API Key e nome da instância
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>URL da API</Label>
                  <Input
                    placeholder="https://api.uazapi.com"
                    value={config.api_url}
                    onChange={(e) => setConfig((p) => ({ ...p, api_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key (Admin)</Label>
                  <Input
                    type="password"
                    placeholder="Token admin da UaZapi"
                    value={config.api_key}
                    onChange={(e) => setConfig((p) => ({ ...p, api_key: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nome da Instância</Label>
                  <Input
                    placeholder="suporte-assistente"
                    value={config.instance_name}
                    onChange={(e) => setConfig((p) => ({ ...p, instance_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token da Instância</Label>
                  <Input
                    type="password"
                    placeholder="Gerado ao criar instância"
                    value={config.instance_token}
                    onChange={(e) => setConfig((p) => ({ ...p, instance_token: e.target.value }))}
                    readOnly={!config.instance_token}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={saveConfig} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar
                </Button>
                <Button variant="outline" onClick={createInstance} disabled={creatingInstance || !config.id}>
                  {creatingInstance ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Criar Instância
                </Button>
                <Button variant="outline" onClick={fetchQrCode} disabled={checkingStatus || !config.instance_token}>
                  {checkingStatus ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <QrCode className="h-4 w-4 mr-2" />}
                  QR Code
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code */}
          {qrCode && (
            <Card>
              <CardHeader>
                <CardTitle>Escaneie o QR Code</CardTitle>
                <CardDescription>Abra o WhatsApp &gt; Dispositivos conectados &gt; Conectar dispositivo</CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <img src={qrCode} alt="QR Code WhatsApp" className="max-w-xs rounded-lg border" />
              </CardContent>
            </Card>
          )}

          {/* Webhook URL */}
          {config.instance_name && (
            <Card>
              <CardHeader>
                <CardTitle>Webhook URL</CardTitle>
                <CardDescription>Configure esta URL no webhook da instância UaZapi</CardDescription>
              </CardHeader>
              <CardContent>
                <code className="block p-3 bg-muted rounded text-xs break-all">{webhookUrl}</code>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
