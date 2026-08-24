import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Sparkles, CheckCircle2 } from 'lucide-react';

type ChangelogItem = {
  category: 'novo' | 'melhoria' | 'correcao';
  text: string;
};

const releases = [
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
