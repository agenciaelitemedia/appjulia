

Vou analisar o fork `fazer-ai/chatwoot` para extrair expertise e enriquecer nosso roteiro.
<lov-tool-use id="toolu_vrtx_01HX43t4zZsctHsXkJVbmd2w" name="code--fetch_website" integration-id="code" data="{\"url\": \"https://github.com/fazer-ai/chatwoot\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01ENUM27A3PQfVttgoLb7SLg" name="code--fetch_website" integration-id="code" data="{\"url\": \"https://www.chatwoot.com/docs/product\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01C8WjUt56jZeorUUA192LAY" name="code--fetch_website" integration-id="code" data="{\"url\": \"https://github.com/fazer-ai/chatwoot\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KCqfNJQshch3FV7ZFx7xaX" name="code--fetch_website" integration-id="code" data="{\"url\": \"https://www.chatwoot.com/docs/product\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KrqLXkY4XCcDUK1k6sVkus" name="code--view" integration-id="code" data="{\"file_path\": \"tool-results://fetched-websites/github.com_fazer-ai_chatwoot.md\", \"lines\": \"100-365\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WerSb3N51SmFJuEK2nJsUP" name="code--view" integration-id="code" data="{\"file_path\": \"tool-results://fetched-websites/www.chatwoot.com_docs_product.md\", \"lines\": \"18-252\"}">
</lov-tool-use>
I have enough context. The fazer-ai/chatwoot fork specifically integrates Baileys (unofficial WhatsApp) into Chatwoot — directly relevant. Let me build the enhanced plan combining Chatwoot expertise with our existing roadmap.

<lov-plan>

## Análise: Chatwoot (fazer-ai fork) → Diferenciais para o nosso /chat

### O que o fork `fazer-ai/chatwoot` adiciona
É um fork oficial do Chatwoot mantido pela comunidade brasileira que **integra Baileys** (WhatsApp não-oficial via QR Code) como canal nativo, ao lado dos canais oficiais. Estratégia idêntica à nossa (UaZapi + WABA convivendo). Confirma que nosso modelo arquitetural está correto.

### Funcionalidades-chave do Chatwoot que ainda não estão no nosso plano

#### A. Conversação e produtividade
1. **Canned Responses (Respostas Salvas)** com escopo pessoal + global, busca fuzzy, suporte a Markdown e variáveis (`{{contact.name}}`, `{{agent.name}}`, `{{conversation.id}}`) — vai além das nossas Quick Messages
2. **Private Notes @menção** — notas internas que podem `@mencionar` um agente e gerar notificação push direcionada
3. **Conversation Participants** — múltiplos agentes "observando" um mesmo ticket sem serem o assignee (útil para supervisor + atendente)
4. **Keyboard Shortcuts globais** (`?` para abrir cheatsheet) — produtividade séria para operadores
5. **Command Bar (Cmd+K)** — busca universal (contatos, conversas, settings) com navegação por teclado
6. **Conversation Filters salvos como "Custom Views/Folders"** — ex: "Meus VIPs sem resposta há 2h" virou um folder fixo na sidebar
7. **Message signature** por agente (assinatura automática appendada nas mensagens)

#### B. Automação (regras, não só fluxos)
8. **Automation Rules engine** — diferente de chatbot/URA. São regras "if-this-then-that" que disparam em eventos (`conversation_created`, `conversation_updated`, `message_created`):
   - Condições: canal, fila, hora, label, atributo, conteúdo
   - Ações: atribuir agente, adicionar label, mudar status, enviar mensagem, abrir webhook, atribuir time
   - Exemplo: "Se mensagem contém 'cancelar' E é horário comercial → atribuir time Retenção + label urgente"
9. **SLA Policies configuráveis** — first_response_time, next_response_time, resolution_time por canal/prioridade, com escalonamento automático

#### C. Contatos como entidade central (CRM leve)
10. **Contacts module dedicado** com import CSV, merge de duplicados, **histórico unificado de TODAS as conversas do contato em todos os canais**, atributos customizados
11. **Custom Attributes** (por contato e por conversa) — campos dinâmicos definidos pelo admin (ex: "CPF", "Plano", "NPS Score"), tipados (text/number/date/list/checkbox/url)
12. **Contact Segments** — filtros salvos sobre contatos (ex: "Contatos com Plano=Premium e sem conversa há 30d") — usável em campanhas

#### D. Inteligência (Captain AI do Chatwoot)
13. **Copiloto inline na conversa** — sugere respostas baseadas no contexto + base de conhecimento; agente aceita/edita/descarta
14. **Auto-resumo da conversa** — botão "Summarize" gera TL;DR para handoff entre turnos
15. **Reply suggestions** baseadas em respostas salvas ranqueadas por similaridade semântica
16. **AI Topics** — categorização automática de conversas (assunto principal) → vira label

#### E. Help Center / Base de conhecimento
17. **Help Center embutido** — portal público de FAQs/artigos, multilíngue, com domínio próprio. O agente referencia artigos dentro da conversa (drag&drop link)
18. **AI sobre Help Center** — Copiloto consulta artigos antes de sugerir resposta (RAG)

#### F. Multicanal real (além do que já planejamos)
19. **API Channel** genérico — qualquer sistema externo posta mensagens via API e recebe via webhook (útil para integrar ERPs, SMS bureaus brasileiros, Telegram bots)
20. **Email Channel** com IMAP/SMTP — converte e-mails em tickets
21. **Pre-chat form** customizável no widget web (campos obrigatórios antes de iniciar conversa) + **Post-chat survey** (CSAT)
22. **Widget customization** completa: cor, posição, avatar do agente, mensagem de boas-vindas dinâmica, modo "tab" ou "bubble", proatividade (mensagem aparecer após X segundos em página Y)

#### G. Reports profissionais
23. **CSAT Reports** dedicados — não só NPS, mas Customer Satisfaction com 😞😐😊
24. **Bot Reports** — métricas separadas para conversas resolvidas pelo bot vs handoff humano
25. **SLA Reports** — % cumprimento, tickets em risco, breached
26. **Conversation Traffic Reports** — heatmap por dia/hora (quando contratar mais agentes)
27. **Agent Performance** — TMA, conversas resolvidas, CSAT por agente, tempo online
28. **Export CSV** de qualquer relatório

#### H. Integrações nativas
29. **Slack integration bidirecional** — responder ticket direto pelo Slack
30. **Dashboard Apps** — iframe customizado dentro do painel do contato (ex: mostrar pedidos do cliente puxando do ERP via URL com `{contact_id}`)
31. **Outgoing Webhooks** com payload padronizado (já tínhamos no plano, agora com schema definido)

### Diferenciais que vamos AGREGAR ao roadmap original

| # | Funcionalidade Nova | Por que diferencia |
|---|---|---|
| **D1** | Automation Rules engine (não-código) | Cliente configura sem dev, igual Chatwoot/Zendesk |
| **D2** | SLA Policies com escalonamento | Atendimento profissional B2B |
| **D3** | Custom Attributes tipados (contato + conversa) | Adapta o sistema a qualquer vertical sem migration |
| **D4** | Contact Segments + import CSV | Habilita campanhas inteligentes |
| **D5** | Copiloto inline com aceitar/editar | Diferencial vs concorrentes BR (já temos infra Gemini) |
| **D6** | Help Center público + RAG no Copiloto | Reduz volume de tickets repetitivos |
| **D7** | Conversation Participants (observers) | Supervisor acompanha sem assumir |
| **D8** | Private Notes com @menção + notificação | Comunicação interna no ticket |
| **D9** | Command Bar (Cmd+K) global | Produtividade séria |
| **D10** | Custom Views/Folders salvos | Cada agente personaliza visão |
| **D11** | API Channel genérico | Plug de qualquer canal externo (Telegram, SMS, ERP) |
| **D12** | CSAT/SLA/Bot reports separados | Gestão data-driven |
| **D13** | Pre-chat form + CSAT pós-atendimento no widget | Qualificação + satisfação |
| **D14** | Dashboard Apps (iframe contextual) | Mostrar dados do ERP/CRM dentro do ticket |
| **D15** | Message templates com variáveis `{{contact.name}}` | Personalização real |

### Roadmap REVISADO (8 sprints)

```text
Sprint 1 — NÚCLEO PROFISSIONAL
 1.1 Tabs status (Aguardando/Em atendimento/Resolvidos/Todos) com contadores realtime
 1.2 Auto-atribuição ao abrir ticket pending
 1.3 Encerrar com motivo + disparo NPS opcional
 1.4 Forward de mensagem
 1.5 Reações (👍❤️😂) — UaZapi /message/react + WABA reactions
 1.6 Conversation Participants (observers) [NOVO]
 1.7 Private Notes com @menção + push [NOVO]

Sprint 2 — PRODUTIVIDADE & UX
 2.1 Agendamento de mensagens (chat_scheduled_messages + cron)
 2.2 Indicador "digitando..." (Supabase Presence)
 2.3 Mensagens rápidas com mídia + variáveis {{contact.name}} [EXPANDIDO]
 2.4 Command Bar Cmd+K global [NOVO]
 2.5 Keyboard shortcuts + cheatsheet (?) [NOVO]
 2.6 Custom Views/Folders salvos por agente [NOVO]
 2.7 Busca full-text em mensagens (tsvector)

Sprint 3 — AUTOMAÇÃO E SLA [REPRIORIZADO]
 3.1 Automation Rules engine (UI + executor) [NOVO — DIFERENCIAL]
     - Triggers: conversation_created/updated, message_created
     - Conditions builder visual
     - Actions: assign, label, status, send_message, webhook
 3.2 SLA Policies (first_response, next_response, resolution) com badges e escalonamento [NOVO]
 3.3 Mensagem boas-vindas + fora-horário por fila
 3.4 Auto-fechamento por inatividade

Sprint 4 — CHATBOT/URA + IA COPILOTO
 4.1 Builder simples de fluxo por fila (chat_queue_flows)
 4.2 Triagem com IA (Lovable AI / Gemini Flash) classifica intent → roteia
 4.3 Copiloto inline (sugere resposta, agente aceita/edita) [NOVO — Captain-like]
 4.4 Auto-resumo de conversa para handoff [NOVO]
 4.5 AI Topics (categorização automática vira label) [NOVO]

Sprint 5 — CONTATOS COMO CRM LEVE [NOVO BLOCO]
 5.1 Módulo /chat/contatos com listagem, filtros, busca
 5.2 Custom Attributes tipados (contato + conversa) — admin define
 5.3 Import CSV de contatos
 5.4 Merge de duplicados
 5.5 Histórico unificado cross-channel por contato
 5.6 Contact Segments (filtros salvos)

Sprint 6 — CAMPANHAS
 6.1 Módulo /chat/campanhas com lista, template, variáveis, mídia
 6.2 chat-campaign-runner com rate limit por instância
 6.3 Templates WABA aprovados (Graph API) para campanhas oficiais
 6.4 Origem da lista: Contact Segments criados no Sprint 5
 6.5 Logs por contato (enviado, lido, respondeu, erro)

Sprint 7 — HELP CENTER + KNOWLEDGE [NOVO BLOCO]
 7.1 Help Center público (artigos, categorias, busca)
 7.2 Editor Markdown com versionamento
 7.3 Domínio customizado por tenant
 7.4 RAG: Copiloto consulta artigos antes de sugerir
 7.5 Botão "Inserir artigo" na conversa (link direto)

Sprint 8 — GESTÃO E REPORTS
 8.1 /chat/conexoes (UI QR Code UaZapi + status WABA + Instagram)
 8.2 Dashboard /chat/dashboard com TMA, TME, msgs/dia, agentes
 8.3 CSAT Reports dedicados (😞😐😊)
 8.4 SLA Reports (% cumprimento, breached)
 8.5 Bot Reports (resolvidas pelo bot vs handoff)
 8.6 Conversation Traffic heatmap (dia/hora)
 8.7 Agent Performance individual
 8.8 Export CSV
 8.9 Dashboard Apps (iframe contextual no painel do contato) [NOVO]
 8.10 Outgoing Webhooks configuráveis
 8.11 API Channel genérico (POST mensagem, webhook saída) [NOVO]
 8.12 Pre-chat form + CSAT pós-conversa no widget web
```

### Novas tabelas adicionadas ao plano

```text
chat_automation_rules        (id, name, trigger_event, conditions_json, actions_json, active)
chat_sla_policies            (id, name, channel, priority, first_resp_min, next_resp_min, resolution_min, escalate_to)
chat_conversation_sla        (conversation_id, policy_id, first_resp_at, breached_at, status)
chat_conversation_participants (conversation_id, user_id, role)
chat_custom_attributes_def   (id, scope[contact|conversation], key, label, type, options)
chat_custom_attributes_value (entity_id, scope, key, value)
chat_contact_segments        (id, name, filters_json, owner_id)
chat_help_center_articles    (id, slug, title, content_md, category, locale, status)
chat_help_center_categories  (id, slug, name, locale, parent_id)
chat_dashboard_apps          (id, name, url_template, position, scope)
chat_api_channels            (id, name, inbound_token, outbound_webhook_url)
chat_canned_responses        (id, scope[user|account], shortcode, content_md, owner_id)
chat_csat_responses          (conversation_id, score, feedback, created_at)
chat_user_views              (id, user_id, name, filters_json)
```

### Novas Edge Functions

```text
chat-automation-runner       (escuta eventos via Realtime, executa rules)
chat-sla-monitor             (cron 1min: detecta breach, escala, notifica)
chat-copilot-suggest         (Gemini Flash + RAG no Help Center)
chat-summarize               (resumo da conversa atual)
chat-classify-topic          (classifica conversa → label automática)
chat-helpcenter-search       (busca semântica nos artigos — pgvector)
chat-contacts-import         (parse CSV, dedupe, batch insert)
chat-api-channel-inbound     (recebe POST de canais externos)
chat-widget-config           (serve config do widget web por client_id)
```

### O que NÃO copiamos do Chatwoot

- Stack Rails/Sidekiq → mantemos Lovable Cloud + Edge Functions + Realtime
- ActionCable → usamos Supabase Realtime (mais simples)
- Vue.js frontend → mantemos React + shadcn
- Postgres ENUM rígidos → preferimos JSONB para configs flexíveis
- Storage S3 próprio → Supabase Storage
- Captain como produto separado → integramos direto no fluxo (sem upsell)

### Próximo passo

Aprove o plano expandido e me diga **por onde começar**:
- **Opção A (recomendada)**: Sprint 1 completo — entrega valor visível em 1 sessão (tabs, auto-atribuição, NPS, forward, reações, observers, @menção)
- **Opção B (diferencial competitivo)**: Sprint 3 — Automation Rules + SLA (o que mais diferencia de concorrentes BR)
- **Opção C (IA primeiro)**: Sprint 4 — Copiloto inline + auto-resumo (vende muito)
- **Opção D**: customizado, escolher itens específicos cross-sprint

