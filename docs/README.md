# Documentação Julia

Estudo técnico do sistema (gerado por análise do código-fonte, 2026-07). Ponto de entrada: [`../CLAUDE.md`](../CLAUDE.md).

## Arquitetura por domínio
- [data-layer.md](data-layer.md) — os dois bancos (Supabase + Postgres externo via `db-query`), auth, multi-tenancy, edge functions, roteamento.
- [chat.md](chat.md) — módulo Chat/WhatsApp (canais, filas, fluxo, SLA, recursos, vínculo com tickets).
- [uazapi-integration.md](uazapi-integration.md) — detalhe interno do webhook uazapi + pipeline de histórico.
- [crm-agents-legal.md](crm-agents-legal.md) — CRM, CRM Builder, Agentes IA, Followup, Contratos, jurídico, Copiloto, Admin.
- [tickets-telemetry.md](tickets-telemetry.md) — Helpdesk/Tickets, Telemetria, Notificações.
- [telephony-payments.md](telephony-payments.md) — Telefonia (SIP/Wavoip), Pagamentos, Vídeo.

## Handoff de dados (para agentes de IA)
- [data-handoff.md](data-handoff.md) — dossiê para outro agente se conectar aos dois bancos: como consultar cada um, chaves de correlação (telefone/`cod_agent`/`client_id`), dicionário de tabelas verificado ao vivo, mecanismo de integração Chat↔CRM↔Agentes, cookbook de queries de relatório e riscos a observar.

## Copiloto Jurídico
- **[x-julia-GPT-co-piloto.md](x-julia-GPT-co-piloto.md) — documento consolidado, começar por aqui.** Funde os dois estudos abaixo: as três rotas de integração com IA (conector MCP+OAuth, copiloto na interface, ponte de sessão) com a análise de risco de cada uma, o núcleo de ferramentas compartilhado, compilador de contexto do lead, leitura de documentos, biblioteca de prompts jurídicos, UX, artefatos, modelo de dados e roadmap.
- [copiloto-juridico.md](copiloto-juridico.md) — estudo de origem: restrições dos fornecedores, MCP+OAuth 2.1 e copiloto com guard/streaming.
- [integracao-ia-pro-auth.md](integracao-ia-pro-auth.md) — estudo de origem: rotas de sessão (extensão/daemon), casos de uso jurídicos, UX e prompts.

## Protótipos
- [prototipos/callcenter-recuperacao.html](prototipos/callcenter-recuperacao.html) — protótipo navegável do módulo **Call Center (Recuperação de Oportunidades)**: fila priorizada de leads com problema + workspace com fluxo guiado sequencial e a conversa do WhatsApp sempre visível. Abrir direto no navegador.

## Relatório
- `../Julia-Relatorio-Tecnico.pdf` — versão consolidada em PDF (gerada a partir dos `.md` acima).
