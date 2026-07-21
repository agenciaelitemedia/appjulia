# Documentação Julia

Estudo técnico do sistema (gerado por análise do código-fonte, 2026-07). Ponto de entrada: [`../CLAUDE.md`](../CLAUDE.md).

## Arquitetura por domínio
- [data-layer.md](data-layer.md) — os dois bancos (Supabase + Postgres externo via `db-query`), auth, multi-tenancy, edge functions, roteamento.
- [chat.md](chat.md) — módulo Chat/WhatsApp (canais, filas, fluxo, SLA, recursos, vínculo com tickets).
- [uazapi-integration.md](uazapi-integration.md) — detalhe interno do webhook uazapi + pipeline de histórico.
- [crm-agents-legal.md](crm-agents-legal.md) — CRM, CRM Builder, Agentes IA, Followup, Contratos, jurídico, Copiloto, Admin.
- [tickets-telemetry.md](tickets-telemetry.md) — Helpdesk/Tickets, Telemetria, Notificações.
- [telephony-payments.md](telephony-payments.md) — Telefonia (SIP/Wavoip), Pagamentos, Vídeo.

## Protótipos
- [prototipos/callcenter-recuperacao.html](prototipos/callcenter-recuperacao.html) — protótipo navegável do módulo **Call Center (Recuperação de Oportunidades)**: fila priorizada de leads com problema + workspace com fluxo guiado sequencial e a conversa do WhatsApp sempre visível. Abrir direto no navegador.

## Relatório
- `../Julia-Relatorio-Tecnico.pdf` — versão consolidada em PDF (gerada a partir dos `.md` acima).
