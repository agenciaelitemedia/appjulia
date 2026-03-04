import { useState, useMemo } from 'react';
import { Link2, Link2Off, Trash2, Building2, Bot, Crown, Eye, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { UserWithPermissions } from '../../permissoes/types';
import {
  useUserLinkedAgents,
  useAvailableAgents,
  useLinkAgent,
  useUnlinkAgent,
  useUpdateAgentOwnership,
} from '../hooks/useMonitoramentoData';

interface MonitoramentoEditorProps {
  user: UserWithPermissions;
}

export function MonitoramentoEditor({ user }: MonitoramentoEditorProps) {
  const { data: linkedAgents = [], isLoading: loadingLinked } = useUserLinkedAgents(user.id);
  const { data: availableAgents = [], isLoading: loadingAvailable } = useAvailableAgents(user.id);
  const linkAgent = useLinkAgent();
  const unlinkAgent = useUnlinkAgent();
  const updateOwnership = useUpdateAgentOwnership();

  const [searchLinked, setSearchLinked] = useState('');
  const [searchAvailable, setSearchAvailable] = useState('');
  const [linkAsOwner, setLinkAsOwner] = useState<Record<string, boolean>>({});

  const filterAgent = (agent: any, term: string) => {
    if (!term) return true;
    if (term.includes(',')) {
      const codes = term.split(',').map(c => c.trim()).filter(Boolean);
      return codes.includes(agent.cod_agent?.toString());
    }
    const t = term.toLowerCase();
    return (
      agent.client_name?.toLowerCase().includes(t) ||
      agent.business_name?.toLowerCase().includes(t) ||
      agent.cod_agent?.toString().includes(t)
    );
  };

  const filteredLinked = useMemo(() => linkedAgents.filter((a: any) => filterAgent(a, searchLinked)), [linkedAgents, searchLinked]);
  const filteredAvailable = useMemo(() => availableAgents.filter((a: any) => filterAgent(a, searchAvailable)), [availableAgents, searchAvailable]);

  const handleLink = (agent: { id: number; cod_agent: string }) => {
    const isOwner = linkAsOwner[agent.cod_agent] ?? false;
    linkAgent.mutate({
      userId: user.id,
      agentId: isOwner ? agent.id : null,
      codAgent: agent.cod_agent,
    });
  };

  const handleUnlink = (codAgent: string) => {
    unlinkAgent.mutate({ userId: user.id, codAgent });
  };

  const handleToggleOwnership = (agent: { cod_agent: string; agent_id: number | null; agent_id_from_agents: number }) => {
    const newAgentId = agent.agent_id ? null : agent.agent_id_from_agents;
    updateOwnership.mutate({
      userId: user.id,
      codAgent: agent.cod_agent,
      agentId: newAgentId,
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold">{user.name}</h2>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <Tabs defaultValue="linked" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-4">
          <TabsTrigger value="linked" className="flex items-center gap-1.5">
            <Link2 className="w-4 h-4" />
            Vinculados ({linkedAgents.length})
          </TabsTrigger>
          <TabsTrigger value="available" className="flex items-center gap-1.5">
            <Link2Off className="w-4 h-4" />
            Disponíveis ({availableAgents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="linked" className="flex-1 m-0 p-0">
          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar agente vinculado..."
                value={searchLinked}
                onChange={(e) => setSearchLinked(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-430px)]">
            <div className="p-4 space-y-2">
              {loadingLinked ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))
              ) : filteredLinked.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{searchLinked ? 'Nenhum resultado encontrado' : 'Nenhum agente vinculado'}</p>
                </div>
              ) : (
                filteredLinked.map((agent: any) => (
                  <div
                    key={agent.cod_agent}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{agent.client_name || '-'}</div>
                        {agent.business_name && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {agent.business_name}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground font-mono">
                          cod: {agent.cod_agent}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={agent.agent_id ? 'default' : 'secondary'}
                        className="cursor-pointer text-xs"
                        onClick={() => handleToggleOwnership(agent)}
                      >
                        {agent.agent_id ? (
                          <><Crown className="w-3 h-3 mr-1" /> Proprietário</>
                        ) : (
                          <><Eye className="w-3 h-3 mr-1" /> Monitorado</>
                        )}
                      </Badge>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Desvincular agente</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover o vínculo do agente <strong>{agent.client_name}</strong> com este usuário?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleUnlink(agent.cod_agent)}>
                              Desvincular
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="available" className="flex-1 m-0 p-0">
          <div className="px-4 pt-3 pb-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar agente disponível..."
                value={searchAvailable}
                onChange={(e) => setSearchAvailable(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-430px)]">
            <div className="p-4 space-y-2">
              {loadingAvailable ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-lg" />
                ))
              ) : filteredAvailable.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bot className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{searchAvailable ? 'Nenhum resultado encontrado' : 'Todos os agentes já estão vinculados'}</p>
                </div>
              ) : (
                filteredAvailable.map((agent: any) => (
                  <div
                    key={agent.cod_agent}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Bot className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{agent.client_name || '-'}</div>
                        {agent.business_name && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Building2 className="w-3 h-3" />
                            {agent.business_name}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground font-mono">
                          cod: {agent.cod_agent}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`owner-${agent.cod_agent}`}
                          checked={linkAsOwner[agent.cod_agent] ?? false}
                          onCheckedChange={(v) =>
                            setLinkAsOwner((prev) => ({ ...prev, [agent.cod_agent]: v }))
                          }
                        />
                        <Label htmlFor={`owner-${agent.cod_agent}`} className="text-xs cursor-pointer">
                          Proprietário
                        </Label>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => handleLink(agent)}
                        disabled={linkAgent.isPending}
                      >
                        <Link2 className="w-4 h-4 mr-1" />
                        Vincular
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
