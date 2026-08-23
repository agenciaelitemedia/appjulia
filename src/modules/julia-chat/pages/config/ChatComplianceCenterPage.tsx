import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, FileSearch, UserX, ScrollText, KeySquare, Plus, Trash2 } from "lucide-react";
import { useAuditLog } from "@/hooks/useChatAuditLog";
import { useLgpdRequests, useCreateLgpdRequest, useUpdateLgpdRequest, type LgpdType } from "@/hooks/useChatLgpdRequests";
import { useRolePermissions, useUpsertRole, useDeleteRole, PERMISSION_KEYS } from "@/hooks/useChatRolePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const SEVERITY_COLORS: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-yellow-500",
  critical: "bg-destructive",
};

const LGPD_STATUS: Record<string, string> = {
  pending: "bg-yellow-500",
  processing: "bg-blue-500",
  completed: "bg-emerald-600",
  rejected: "bg-destructive",
};

export default function ChatComplianceCenterPage() {
  const { user } = useAuth();
  const clientId = (user as any)?.cod_agent || "default";

  const { data: audit = [] } = useAuditLog({ clientId });
  const { data: lgpd = [] } = useLgpdRequests(clientId);
  const { data: roles = [] } = useRolePermissions(clientId);
  const createLgpd = useCreateLgpdRequest();
  const updateLgpd = useUpdateLgpdRequest();
  const upsertRole = useUpsertRole();
  const deleteRole = useDeleteRole();

  const [lgpdForm, setLgpdForm] = useState({ contact_phone: "", request_type: "export" as LgpdType, reason: "" });
  const [roleForm, setRoleForm] = useState<{ role_name: string; description: string; permissions: Record<string, boolean> }>({
    role_name: "", description: "", permissions: {},
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-7 w-7 text-primary" />
          Centro de Segurança & Compliance
        </h1>
        <p className="text-muted-foreground">Auditoria, LGPD, papéis e permissões</p>
      </div>

      <Tabs defaultValue="audit">
        <TabsList>
          <TabsTrigger value="audit"><ScrollText className="h-4 w-4 mr-2" />Auditoria</TabsTrigger>
          <TabsTrigger value="lgpd"><FileSearch className="h-4 w-4 mr-2" />LGPD</TabsTrigger>
          <TabsTrigger value="roles"><KeySquare className="h-4 w-4 mr-2" />Papéis & Permissões</TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <Card>
            <CardHeader><CardTitle>Log de auditoria ({audit.length})</CardTitle></CardHeader>
            <CardContent>
              {audit.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum evento registrado ainda</p>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {audit.map((e) => (
                    <div key={e.id} className="border rounded-lg p-3 hover:bg-muted/50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge className={SEVERITY_COLORS[e.severity]}>{e.severity}</Badge>
                          <span className="font-medium">{e.action}</span>
                          <span className="text-xs text-muted-foreground">{e.resource_type}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{format(new Date(e.created_at), "dd/MM/yy HH:mm:ss", { locale: ptBR })}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Por: {e.actor_name || e.actor_identifier || "—"} {e.actor_ip && `· IP ${e.actor_ip}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lgpd" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><UserX className="h-5 w-5" />Nova solicitação LGPD</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Telefone do titular" value={lgpdForm.contact_phone} onChange={(e) => setLgpdForm({ ...lgpdForm, contact_phone: e.target.value })} />
              <select className="w-full border rounded-md p-2 bg-background" value={lgpdForm.request_type} onChange={(e) => setLgpdForm({ ...lgpdForm, request_type: e.target.value as LgpdType })}>
                <option value="export">Exportar dados</option>
                <option value="anonymize">Anonimizar</option>
                <option value="delete">Excluir definitivamente</option>
              </select>
              <Textarea placeholder="Justificativa" value={lgpdForm.reason} onChange={(e) => setLgpdForm({ ...lgpdForm, reason: e.target.value })} />
              <Button onClick={async () => {
                if (!lgpdForm.contact_phone) return;
                await createLgpd.mutateAsync({ client_id: clientId, ...lgpdForm });
                setLgpdForm({ contact_phone: "", request_type: "export", reason: "" });
              }}>Registrar solicitação</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Solicitações ({lgpd.length})</CardTitle></CardHeader>
            <CardContent>
              {lgpd.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhuma solicitação</p>
              ) : (
                <div className="space-y-2">
                  {lgpd.map((r) => (
                    <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="font-medium">{r.contact_phone}</div>
                        <div className="text-xs text-muted-foreground">{r.request_type} · {format(new Date(r.created_at), "dd/MM/yy", { locale: ptBR })}</div>
                        {r.reason && <div className="text-xs mt-1">{r.reason}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={LGPD_STATUS[r.status]}>{r.status}</Badge>
                        {r.status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => updateLgpd.mutate({ id: r.id, status: "completed", processed_at: new Date().toISOString() })}>Concluir</Button>
                            <Button size="sm" variant="ghost" onClick={() => updateLgpd.mutate({ id: r.id, status: "rejected" })}>Rejeitar</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Novo papel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Nome do papel (ex: Supervisor)" value={roleForm.role_name} onChange={(e) => setRoleForm({ ...roleForm, role_name: e.target.value })} />
              <Input placeholder="Descrição" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                {PERMISSION_KEYS.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={!!roleForm.permissions[p.key]} onCheckedChange={(v) => setRoleForm({ ...roleForm, permissions: { ...roleForm.permissions, [p.key]: !!v } })} />
                    {p.label}
                  </label>
                ))}
              </div>
              <Button onClick={async () => {
                if (!roleForm.role_name) return;
                await upsertRole.mutateAsync({ client_id: clientId, ...roleForm });
                setRoleForm({ role_name: "", description: "", permissions: {} });
              }}><Plus className="h-4 w-4 mr-1" />Salvar papel</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Papéis ({roles.length})</CardTitle></CardHeader>
            <CardContent>
              {roles.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum papel criado</p>
              ) : (
                <div className="space-y-2">
                  {roles.map((r) => {
                    const granted = Object.entries(r.permissions || {}).filter(([, v]) => v).length;
                    return (
                      <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between">
                        <div>
                          <div className="font-medium">{r.role_name}</div>
                          <div className="text-xs text-muted-foreground">{r.description || "—"} · {granted} permissões</div>
                        </div>
                        {!r.is_system && <Button size="icon" variant="ghost" onClick={() => deleteRole.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
