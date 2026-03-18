

## Plano: Modulo Administrativo do Copiloto + Insights Monitor + Copiloto Interativo

### Escopo

1. **Novo modulo de permissao `copilot_admin`** — registrado como modulo no DB externo (mesmo padrao do `monitoring`), acessivel via `/admin/copiloto`, controlado por permissoes
2. **Tela de monitoramento de insights** — `/admin/copiloto` com filtros por data, agente, tipo, severidade, listando todos os insights gerados
3. **Tela de configuracao do copiloto** — dentro da pagina admin, configurar tipos de alertas e tarefas analisaveis (baseado nos tipos existentes: `stuck_lead`, `hot_opportunity`, `risk`, `follow_up_needed`, `summary`)
4. **Insight cards com `related_cards` clicaveis** — cada insight mostra leads envolvidos; ao clicar navega para `/crm/leads?search={whatsapp_number}`
5. **Toggle "Copiloto Interativo" no ConfigStep** — sub-opcao que aparece quando `COPILOT_ENABLED=true`; adiciona `COPILOT_INTERACTIVE` ao settings JSON
6. **Widget com abas: Alertas + Chat** — o CopilotWidget ganha tabs; a aba "Chat" (so visivel se algum agente do usuario tem `COPILOT_INTERACTIVE=true`) permite enviar perguntas sobre o CRM
7. **Edge function `copilot-chat`** — recebe pergunta + user_id, busca APENAS os agentes vinculados ao usuario, consulta dados do CRM desses agentes e responde via Lovable AI. Trava de seguranca: filtra `user_agents.user_id = userId` no SQL

### Seguranca do Chat

A edge function `copilot-chat` recebe o `user_id` do contexto autenticado. Toda query ao DB externo faz `JOIN user_agents ua ON ua.user_id = ${userId}` garantindo que o usuario so acessa dados dos seus proprios agentes, independente do que solicitar no prompt.

### Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `src/pages/admin/copiloto/CopilotAdminPage.tsx` | Pagina admin com tabs: Insights Monitor + Configuracoes |
| `src/pages/admin/copiloto/components/InsightsMonitorTab.tsx` | Lista paginada com filtros (data, agente, tipo, severidade) |
| `src/pages/admin/copiloto/components/InsightDetailCard.tsx` | Card expandido com related_cards clicaveis (navega ao CRM) |
| `src/pages/admin/copiloto/components/CopilotSettingsTab.tsx` | Config de tipos de alertas ativaveis, prompt base, intervalos globais |
| `src/pages/admin/copiloto/hooks/useCopilotAdmin.ts` | Hook para queries de insights com filtros + config |
| `src/hooks/useEnsureCopilotModule.ts` | Hook para garantir modulo `copilot_admin` existe (padrao do monitoramento) |
| `supabase/functions/copilot-chat/index.ts` | Edge function do chat interativo com trava de seguranca por user_id |

### Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `src/App.tsx` | Adicionar rota `/admin/copiloto` com ProtectedRoute |
| `src/components/layout/Sidebar.tsx` | Importar `useEnsureCopilotModule` |
| `src/pages/agents/components/wizard-steps/ConfigStep.tsx` | Adicionar toggle `COPILOT_INTERACTIVE` (visivel quando COPILOT_ENABLED=true) |
| `src/components/copilot/CopilotWidget.tsx` | Refatorar para ter Tabs (Alertas / Chat); aba Chat so aparece se usuario tem agente com COPILOT_INTERACTIVE |
| `src/hooks/useCopilotInsights.ts` | Adicionar campo para verificar se usuario tem copiloto interativo |
| `src/types/permissions.ts` | Adicionar `'copilot_admin'` ao union `ModuleCode` |

### Tabela Supabase (migracao)

Adicionar tabela `crm_copilot_settings` para config global do copiloto:

| Coluna | Tipo | Default |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | integer | NOT NULL |
| enabled_insight_types | jsonb | `["stuck_lead","hot_opportunity","risk","follow_up_needed","summary"]` |
| custom_prompt_suffix | text | NULL |
| max_insights_per_run | integer | 5 |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### Fluxo do Chat Interativo

```text
Usuario digita no Chat do Widget
    → POST copilot-chat { message, user_id }
        → Busca agentes do usuario (user_agents WHERE user_id = X)
        → Busca cards CRM desses agentes
        → Monta contexto + pergunta
        → Chama Lovable AI (streaming)
        → Retorna resposta
```

### UI do Widget com Abas

```text
┌─────────────────────────┐
│ Copiloto Julia           │
│ [Alertas] [Chat]         │
├─────────────────────────┤
│  (conteudo da aba ativa) │
│                          │
└─────────────────────────┘
```

