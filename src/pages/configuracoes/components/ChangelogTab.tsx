import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Sparkles, CheckCircle2 } from 'lucide-react';

type ChangelogItem = {
  category: 'novo' | 'melhoria' | 'correcao';
  text: string;
};

const releases = [
  {
    version: 'v2.19',
    date: '25 de agosto de 2026',
    highlight: 'Performance do JulIA Chat e saúde do banco de dados.',
    items: [
      { category: 'melhoria', text: 'Lista de conversas usa stale-while-revalidate: retorna imediatamente o cache e atualiza os dados em background.' },
      { category: 'melhoria', text: 'Trava de atualização em background evita requisições duplicadas simultâneas para o mesmo escritório.' },
      { category: 'melhoria', text: 'Redução da rajada inicial de requisições entre abas do chat (warmup mais espaçado e desativado durante buscas).' },
      { category: 'melhoria', text: 'Deduplicação de mensagens na ingestão via busca por sufixo indexada, eliminando consultas lentas.' },
      { category: 'melhoria', text: 'Limpeza automática diária de logs antigos, liberando espaço em disco do banco.' },
      { category: 'correcao', text: 'Marcação de leitura sem atualizações redundantes e monitoramento de histórico com menos polling.' },
      { category: 'correcao', text: 'Devolução automática para a fila passa a considerar o horário de atribuição do responsável (NRT).' },
    ] as ChangelogItem[],
  },
  {

    version: 'v2.18',
    date: '25 de agosto de 2026',
    highlight: 'Personalização de layout dos painéis e refinamento do JulIA Chat.',
    items: [
      { category: 'novo', text: 'Configuração de exibição dos funis no Dashboard: escolha entre Padrão (3 colunas) ou Full (1 por linha), com preferência salva no navegador.' },
      { category: 'novo', text: 'Toggle de visualização grid/lista em /estrategico/campanhas para Funil de Conversão, Performance por Plataforma, Melhores Horários e Top Campanhas.' },
      { category: 'melhoria', text: 'Redirecionamento pós-login: usuários não-proprietários com acesso ao chat vão direto para /chat.' },
      { category: 'melhoria', text: 'Busca no JulIA Chat só dispara ao pressionar Enter, evitando requisições a cada caractere.' },
      { category: 'melhoria', text: 'Contador de resultados também aparece na aba Encerradas durante buscas.' },
      { category: 'melhoria', text: 'Badges de status do JulIA Chat com fundo cinza claro para melhor legibilidade.' },
      { category: 'correcao', text: 'Fallback para Lovable AI quando a transcrição de áudio encontra indisponibilidade de créditos na IA principal.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.17',
    date: 'Agosto de 2026',
    highlight: 'Ajustes de layout, login e busca no JulIA Chat.',
    items: [
      { category: 'melhoria', text: 'Redirecionamento pós-login para /chat quando o usuário não é proprietário e tem permissão de chat.' },
      { category: 'melhoria', text: 'Busca no JulIA Chat ativada somente ao pressionar Enter.' },
      { category: 'melhoria', text: 'Badge de total de resultados na aba Encerradas durante buscas.' },
      { category: 'melhoria', text: 'Fundo cinza claro nos badges de status do JulIA Chat.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.16',
    date: '24 de agosto de 2026',
    highlight: 'JulIA Chat vira experiência principal e CRM ganha mais controle.',
    items: [
      { category: 'novo', text: 'JulIA Chat é o chat principal: rota /chat agora carrega a nova interface de conversas.' },
      { category: 'novo', text: 'Right-bar fixa na conversa com abas de Contato, CRM e Lead.' },
      { category: 'novo', text: 'Botão de gerar resumo do atendimento direto na barra de conversa.' },
      { category: 'novo', text: 'Painel de conversas adiadas (snooze) com contador e notificação de retorno.' },
      { category: 'melhoria', text: 'Sidebar recolhida por padrão; usuário expande ao clicar no ícone.' },
      { category: 'melhoria', text: 'Totalizadores do CRM mostram percentual por etapa em relação ao total.' },
      { category: 'melhoria', text: 'Badges de Responsável, Júlia, CRM Builder e Campanha com menus de ação.' },
      { category: 'melhoria', text: 'Fim da lista de conversa exibe badge com total carregado.' },
      { category: 'correcao', text: 'Imagens, áudios, vídeos e stickers da API oficial (WABA) agora renderizam corretamente.' },
      { category: 'correcao', text: 'Resumos automáticos persistem na conversa e aparecem na aba Resumo.' },
      { category: 'correcao', text: 'Fusos horários unificados para Brasília em operações do CRM e chat.' },
      { category: 'correcao', text: 'Busca por telefone normaliza variações de 12 e 13 dígitos.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.15',
    date: 'Agosto de 2026',
    highlight: 'Base do novo chat unificado e ajustes de CRM.',
    items: [
      { category: 'novo', text: 'Protótipo do JulIA Chat com lista, filtros e conversa em colunas.' },
      { category: 'novo', text: 'MVP de automações visuais com React Flow.' },
      { category: 'melhoria', text: 'Permissões granulares nos boards do CRM Builder.' },
      { category: 'correcao', text: 'Ajustes na deduplicação de pipelines e deals do X-Julia.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.14',
    date: 'Agosto de 2026',
    highlight: 'Notificações e Alertas com CRM próprio.',
    items: [
      { category: 'novo', text: 'Módulo de Notificações e Alertas com disparos por WhatsApp e regras configuráveis.' },
      { category: 'novo', text: 'CRM de alertas com etapas, códigos de etapa e filtros por URL.' },
      { category: 'melhoria', text: 'Cards de alerta atualizam em tempo real e recebem etiqueta "Parou de responder".' },
      { category: 'correcao', text: 'Janela de 10 minutos evita reenvio duplicado de notificações.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.13',
    date: 'Agosto de 2026',
    highlight: 'X-Julia (Extreme Julia): novo motor de agentes.',
    items: [
      { category: 'novo', text: 'Agente recepcionista com subagentes especialistas por tipo de caso jurídico.' },
      { category: 'novo', text: 'Memória longa da conversa, leitura de imagens/documentos e skill de áudio.' },
      { category: 'novo', text: 'Geração de contrato com ZapSign e variáveis de data por extenso.' },
      { category: 'melhoria', text: 'Controle de custo por sessão e catálogo de modelos por escritório.' },
      { category: 'correcao', text: 'Deduplicação de pipelines e deals do X-Julia.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.12',
    date: 'Julho de 2026',
    highlight: 'Escritórios sem agente de IA e portal BlitzLeads.',
    items: [
      { category: 'novo', text: 'Módulo Escritórios: cadastro de cliente/usuário sem agente, com wizard e dashboard próprio.' },
      { category: 'novo', text: 'BlitzLeads: portal do cliente em subdomínio dedicado.' },
      { category: 'melhoria', text: 'Liberação de chat, CRM, telefonia, equipe e central de ajuda para escritórios sem IA.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.11',
    date: 'Julho de 2026',
    highlight: 'Automações visuais e permissões do CRM Builder.',
    items: [
      { category: 'novo', text: 'Editor visual de automações com React Flow, versionamento e simulação.' },
      { category: 'novo', text: 'Permissionamento por board no CRM Builder.' },
      { category: 'melhoria', text: 'Verificação de proprietário centralizada em todo o sistema.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.10',
    date: 'Junho de 2026',
    highlight: 'Telefonia ZAP Call e sincronização de mensagens.',
    items: [
      { category: 'novo', text: 'ZAP Call (Wavoip) com gestão de dispositivos, planos e vínculo de filas.' },
      { category: 'novo', text: 'Ressincronização de conversas pela UaZapi corrigindo datas e mensagens faltantes.' },
      { category: 'melhoria', text: 'Vínculos de fila propagam em tempo real.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.9',
    date: 'Junho de 2026',
    highlight: 'Central de Ajuda, push e mensagens rápidas.',
    items: [
      { category: 'novo', text: 'Central de Ajuda com editor de conteúdo e categorias.' },
      { category: 'novo', text: 'Notificações push (Web Push) com opt-in e painel administrativo.' },
      { category: 'novo', text: 'Mensagens rápidas por atalho "/" no chat.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.8',
    date: 'Maio de 2026',
    highlight: 'Helpdesk e telemetria.',
    items: [
      { category: 'novo', text: 'Tickets/Helpdesk com protocolos, departamentos e anexos.' },
      { category: 'novo', text: 'Telemetria de ambiente, presença e performance da equipe.' },
      { category: 'melhoria', text: 'Assistente de suporte monitorando grupos de WhatsApp com transcrição.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.7',
    date: 'Maio de 2026',
    highlight: 'Checkout, planos e pedidos.',
    items: [
      { category: 'novo', text: 'Checkout público com Mercado Pago, Asaas e InfinityPay.' },
      { category: 'novo', text: 'Gestão de planos e pedidos da Julia no admin.' },
      { category: 'melhoria', text: 'Registro automático de webhooks de pagamento.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.6',
    date: 'Abril de 2026',
    highlight: 'Omnichannel: API oficial, Instagram e WebChat.',
    items: [
      { category: 'novo', text: 'Integração com WhatsApp API oficial (WABA) via Embedded Signup.' },
      { category: 'novo', text: 'Canais de Instagram e WebChat no mesmo inbox.' },
      { category: 'melhoria', text: 'Arquitetura multi-provedor unificada para envio e recebimento.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.5',
    date: 'Abril de 2026',
    highlight: 'Copiloto de IA e biblioteca jurídica.',
    items: [
      { category: 'novo', text: 'Copiloto do CRM com insights automáticos.' },
      { category: 'novo', text: 'Gerador de prompts com versionamento e biblioteca de 103 casos jurídicos.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.4',
    date: 'Março de 2026',
    highlight: 'Contratos, followup e integrações jurídicas.',
    items: [
      { category: 'novo', text: 'Módulo de contratos com cadência de notificações.' },
      { category: 'novo', text: 'Followup automático dos leads.' },
      { category: 'novo', text: 'Monitoramento de processos via DataJud e integração Advbox.' },
    ] as ChangelogItem[],
  },
  {
    version: 'v2.0 – v2.3',
    date: '2026',
    highlight: 'Base do painel: chat, CRM e agentes.',
    items: [
      { category: 'novo', text: 'Inbox de atendimento com filas, tickets e SLA.' },
      { category: 'novo', text: 'CRM de leads e CRM Builder em Kanban.' },
      { category: 'novo', text: 'Gestão de agentes de IA da Julia por escritório.' },
      { category: 'novo', text: 'Permissões por módulo, equipes e papéis (admin, time, advogado, comercial).' },
    ] as ChangelogItem[],
  },
];


const categoryProps: Record<ChangelogItem['category'], { label: string; className: string }> = {
  novo: { label: 'Novo', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  melhoria: { label: 'Melhoria', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  correcao: { label: 'Correção', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export function ChangelogTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle>Changelog</CardTitle>
          </div>
          <CardDescription>
            Histórico de mudanças e novidades do JulIA. Aqui você acompanha o que mudou a cada versão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {releases.map((release) => (
            <div key={release.version} className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-sm font-bold px-2 py-0.5">
                  {release.version}
                </Badge>
                <span className="text-xs text-muted-foreground">{release.date}</span>
              </div>
              <p className="text-sm text-foreground">{release.highlight}</p>
              <ul className="space-y-2">
                {release.items.map((item, idx) => {
                  const cat = categoryProps[item.category];
                  return (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="text-muted-foreground">
                        <span className={cn('mr-2 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', cat.className)}>
                          {cat.label}
                        </span>
                        {item.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Versão atual exibida no chat: <span className="font-mono font-medium text-foreground">v2.16</span>
      </div>
    </div>
  );
}

// helper local para evitar importar cn só por isso
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
