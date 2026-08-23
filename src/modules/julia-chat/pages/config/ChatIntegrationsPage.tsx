import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, ExternalLink, Webhook, BarChart3, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useChatCRMLinks } from '@/hooks/useChatCRMLinks';

export default function ChatIntegrationsPage() {
  const navigate = useNavigate();
  const { list } = useChatCRMLinks();

  const integrations = [
    { id: 'crm_julia', name: 'CRM Júlia', desc: 'Sincronize conversas como leads e movimentações automáticas no CRM.', status: 'connected', icon: Database, action: () => navigate('/crm/leads') },
    { id: 'webhooks', name: 'Webhooks personalizados', desc: 'Envie eventos do chat (mensagens, conversas, atribuições) para qualquer URL externa.', status: 'connected', icon: Webhook, action: () => navigate('/chat/webhooks') },
    { id: 'api', name: 'API REST', desc: 'Crie chaves de API para integrar com sistemas externos via HTTP.', status: 'connected', icon: ExternalLink, action: () => navigate('/chat/api-keys') },
    { id: 'analytics', name: 'Relatórios & Analytics', desc: 'Exporte métricas em CSV/PDF e conecte ao seu BI.', status: 'connected', icon: BarChart3, action: () => navigate('/chat/relatorios') },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Plug className="h-6 w-6 text-primary" /> Integrações</h1>
        <p className="text-sm text-muted-foreground">Conecte o atendimento a outros sistemas e plataformas.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((it) => {
          const Icon = it.icon;
          return (
            <Card key={it.id} className="p-5 space-y-3 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{it.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{it.desc}</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 text-[10px]">Disponível</Badge>
              </div>
              <Button size="sm" variant="outline" onClick={it.action} className="w-full">Configurar</Button>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Database className="h-4 w-4" /> Conversas vinculadas ao CRM ({list.data?.length || 0})</h3>
        {list.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {(list.data || []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conversa vinculada ainda. Use o painel da conversa para criar vínculos.</p>
        )}
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {(list.data || []).slice(0, 50).map((link) => (
            <div key={link.id} className="flex items-center justify-between text-sm bg-muted/40 rounded px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono text-xs truncate">{link.external_id}</div>
                <div className="text-[10px] text-muted-foreground">{link.external_system} · {new Date(link.created_at).toLocaleString('pt-BR')}</div>
              </div>
              {link.external_url && (
                <a href={link.external_url} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
                  Abrir <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
