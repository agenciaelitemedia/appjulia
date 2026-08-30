/**
 * Catálogo das ferramentas do conector MCP, agrupado por domínio.
 * Espelha supabase/functions/_shared/copiloto/tools/index.ts (somente leitura).
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { BookOpen } from 'lucide-react';

const CATALOG: { label: string; tools: [string, string][] }[] = [
  {
    label: 'Contatos e leads',
    tools: [
      ['julia_contatos_buscar', 'Busca leads por telefone ou nome; devolve o contato_id usado nas outras ferramentas.'],
      ['julia_contatos_obter_perfil', 'Dossiê 360º: cadastro, atendimentos, cards no CRM, contratos e ligações.'],
    ],
  },
  {
    label: 'Atendimento e mensagens',
    tools: [
      ['julia_chat_listar_conversas', 'Mesma consulta unificada da tela de chat: fila, SLA, etiquetas, ticket, CRM, campanha e contadores.'],
      ['julia_chat_obter_conversa', 'Detalhes do atendimento: protocolo, fila, SLA, tags, snooze e encerramento.'],
      ['julia_chat_ler_mensagens', 'Histórico cronológico (até 200 mensagens) com transcrição de áudios e link público de cada arquivo.'],
      ['julia_chat_listar_arquivos', 'Anexos trocados no atendimento, com link do arquivo e message_id para leitura.'],
      ['julia_chat_ler_conteudo_arquivo', 'Extrai o texto de PDFs e arquivos de texto enviados pelo lead.'],
      ['julia_chat_historico_atendimento', 'Auditoria: transferências, devoluções à fila, pausas e encerramentos.'],
      ['julia_chat_listar_resumos', 'Resumos de IA já gravados no atendimento.'],
      ['julia_chat_listar_tags', 'Tags/etiquetas cadastradas no escritório.'],
    ],
  },
  {
    label: 'CRM de Leads e CRM Builder',
    tools: [
      ['julia_crm_listar_etapas', 'Etapas do funil clássico com contagem de leads.'],
      ['julia_crm_listar_leads', 'Leads do funil com filtros de etapa, busca e dias parado.'],
      ['julia_crm_historico_lead', 'Movimentações do lead entre etapas.'],
      ['julia_crm_metricas_funil', 'Leads por etapa, percentual e permanência média.'],
      ['julia_crm_notas_internas', 'Notas internas da equipe sobre o lead.'],
      ['julia_builder_listar_quadros', 'Quadros e etapas do CRM Builder com contagem de negócios.'],
      ['julia_builder_listar_negocios', 'Negócios do Builder com filtros de quadro, etapa e busca.'],
      ['julia_builder_obter_negocio', 'Detalhes do negócio: campos, checklists e histórico.'],
    ],
  },
  {
    label: 'Contratos ZapSign',
    tools: [
      ['julia_contratos_listar', 'Contratos por status, período e busca por nome/CPF/telefone.'],
      ['julia_contratos_obter', 'Qualificação completa do signatário, status e resumo do caso.'],
      ['julia_contratos_metricas', 'Enviados, assinados, conversão e tempo médio até assinar.'],
    ],
  },
  {
    label: 'Operação',
    tools: [
      ['julia_filas_listar', 'Filas de atendimento, canais, números e agentes vinculados.'],
      ['julia_equipe_listar', 'Equipe do escritório com papéis e status de acesso.'],
      ['julia_agentes_listar', 'Agentes de IA (cod_agent) vinculados ao escritório.'],
      ['julia_campanhas_listar', 'Campanhas de disparo com janelas, aprovação e resultados.'],
      ['julia_telefonia_listar_chamadas', 'Ligações ZAP Call e VoIP com status, duração e transcrição.'],
      ['julia_tickets_listar', 'Tickets de helpdesk com status, prioridade e SLA.'],
      ['julia_tickets_obter', 'Ticket completo com todas as interações.'],
      ['julia_operacao_indicadores', 'Painel: status, tempo de 1ª resposta, sem responsável e carga por atendente.'],
    ],
  },
  {
    label: 'Análises (o parecer é escrito pelo seu modelo)',
    tools: [
      ['julia_analise_atendimento', 'Dossiê + comando para avaliar como o atendimento foi conduzido.'],
      ['julia_analise_viabilidade_juridica', 'Dossiê + comando de parecer: enquadramento, prescrição, provas e veredito.'],
      ['julia_analise_documental', 'Anexos com texto extraído + comando de auditoria documental.'],
      ['julia_analise_qualificacao_lead', 'Dossiê comercial + comando de score e recomendação.'],
      ['julia_analise_prescricao', 'Linha do tempo + comando de avaliação de prescrição/decadência.'],
      ['julia_analise_contrato', 'Contrato cruzado com a conversa + comando de conferência.'],
    ],
  },
];

export function ToolCatalogCard() {
  const total = CATALOG.reduce((acc, d) => acc + d.tools.length, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Ferramentas disponíveis
          <Badge variant="secondary">{total} · somente leitura</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full">
          {CATALOG.map((domain) => (
            <AccordionItem key={domain.label} value={domain.label}>
              <AccordionTrigger className="text-sm">
                {domain.label}
                <span className="text-xs text-muted-foreground ml-2">{domain.tools.length}</span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2 text-sm">
                  {domain.tools.map(([name, desc]) => (
                    <li key={name}>
                      <code className="text-xs">{name}</code>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
