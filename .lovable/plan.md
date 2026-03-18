

## Plano Atualizado: Copiloto Autônomo da Julia — Toggle no ConfigStep + Widget Global

### Mudanca adicional

Adicionar campo `COPILOT_ENABLED` (boolean, default `false`) no JSON de settings do agente, exibido em **destaque** no topo da aba Config (ConfigStep), antes de todas as outras seções. Isso permite ativar/desativar o copiloto por agente tanto na criação quanto na edição.

### Componentes a implementar

#### 1. Tabelas Supabase (migração)
- `crm_copilot_config` — config por agente (intervalos, horários, last_check_at, last_data_hash)
- `crm_copilot_insights` — insights gerados pela IA (tipo, severidade, título, descrição, is_read)
- Habilitar realtime em `crm_copilot_insights`

#### 2. ConfigStep.tsx — Toggle do Copiloto em destaque
- Adicionar `COPILOT_ENABLED` ao `ConfigFields` e `DEFAULT_CONFIG`
- Renderizar no **topo do componente**, antes da seção "Chat e Resumo", como um Card com visual destacado (borda colorida `border-primary`, fundo `bg-primary/5`):

```text
┌─────────────────────────────────────────────┐
│ 🤖 Copiloto Julia IA                       │
│ Análise automática do CRM com insights      │
│ inteligentes em tempo real                   │
│                                    [SWITCH] │
└─────────────────────────────────────────────┘
```

- Ícone `Bot` ou `Sparkles` do Lucide para destaque visual
- Quando ativado, a edge function `crm-copilot-monitor` inclui esse agente nas análises; quando desativado, pula

#### 3. Edge Function `crm-copilot-monitor`
- Busca agentes ativos no DB externo + verifica se `COPILOT_ENABLED: true` no settings
- Verifica/cria config em `crm_copilot_config` automaticamente para agentes com copiloto ativo
- Hash incremental: só chama IA quando dados mudam
- Frequência adaptativa baseada na config (15min comercial / 2h fora)
- Chama Lovable AI (Gemini Flash) com contexto de cards + mensagens
- Salva insights em `crm_copilot_insights`

#### 4. Widget Global — `CopilotWidget` no MainLayout
- FAB fixo no canto inferior direito com ícone de assistente + badge de unread
- Ao clicar, abre Sheet pela direita com lista de insights
- Realtime subscription para novos insights
- Visível em todas as páginas (renderizado no MainLayout)

#### 5. Hook `useCopilotInsights`
- Query + realtime em `crm_copilot_insights`
- Função markAsRead
- Contagem de unread para badge

#### 6. pg_cron — Agendamento a cada 5 minutos
- A lógica de intervalo (15min vs 2h) fica na edge function

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabelas + realtime |
| `src/pages/agents/components/wizard-steps/ConfigStep.tsx` | Editar — adicionar card COPILOT_ENABLED no topo |
| `supabase/functions/crm-copilot-monitor/index.ts` | Criar |
| `src/components/copilot/CopilotWidget.tsx` | Criar — FAB + Sheet |
| `src/components/copilot/CopilotInsightCard.tsx` | Criar — card de insight |
| `src/hooks/useCopilotInsights.ts` | Criar |
| `src/components/layout/MainLayout.tsx` | Editar — adicionar `<CopilotWidget />` |
| pg_cron SQL | Agendar execução |

