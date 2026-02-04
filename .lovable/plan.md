
# Plano de Implementação: Módulo Campanhas Ads

## Visão Geral

Novo módulo estratégico de análise de campanhas de anúncios que utilizará dados da tabela `campaing_ads` do banco externo. O dashboard apresentará métricas avançadas de performance de campanhas com visualizações estratégicas, incluindo um funil vertical estilizado similar à imagem de referência.

---

## Estrutura de Dados

### Tabela: `campaing_ads` (Banco Externo)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | Identificador único |
| cod_agent | text | Código do agente (multi-tenancy) |
| session_id | text | ID da sessão de atendimento |
| type | text | Tipo de campanha/evento |
| campaign_data | jsonb | Dados da campanha (estrutura abaixo) |
| created_at | timestamp | Data de criação |

### Estrutura do `campaign_data` (JSON)

```json
{
  "title": "Título do anúncio",
  "body": "Texto do anúncio",
  "sourceApp": "facebook | instagram | google",
  "sourceType": "ad | organic",
  "sourceID": "ID da campanha",
  "sourceURL": "URL do anúncio",
  "mediaType": 2,
  "mediaURL": "URL da mídia",
  "thumbnailURL": "URL da thumbnail",
  "conversionSource": "FB_Ads | IG_Ads | etc",
  "greetingMessageBody": "Mensagem de boas-vindas",
  "entryPointConversionApp": "facebook | whatsapp",
  "entryPointConversionSource": "ctwa_ad | organic"
}
```

---

## Métricas e KPIs Propostos

### Cards de Resumo (6 cards)

| Métrica | Descrição | Ícone |
|---------|-----------|-------|
| **Total de Campanhas** | Quantidade de campanhas únicas (sourceID) | Megaphone |
| **Total de Leads** | Total de registros (sessões via ads) | Users |
| **Leads/Campanha** | Média de leads por campanha | Target |
| **Taxa de Conversão** | Leads qualificados / Total de leads | TrendingUp |
| **Plataforma Top** | Fonte com mais conversões | Star |
| **Custo por Lead** | (se disponível) ou engagement rate | DollarSign |

### Gráficos e Visualizações

1. **Funil de Conversão Vertical** (Destaque - Similar à imagem)
   - Leads Captados
   - Leads Qualificados
   - Em Negociação
   - Contratos Gerados
   - Conversões

2. **Performance por Plataforma** (BarChart horizontal)
   - Facebook Ads
   - Instagram Ads
   - Google Ads
   - Outros

3. **Evolução de Leads por Campanha** (AreaChart)
   - Granularidade dinâmica (hora/dia)
   - Comparativo entre campanhas

4. **Heatmap de Horários** (células coloridas)
   - Melhores horários de conversão
   - Dias da semana vs. horários

5. **Top Campanhas** (Tabela ranqueada)
   - Ordenável por leads, conversão, etc.

---

## Arquitetura de Arquivos

```text
src/pages/estrategico/campanhas/
├── CampanhasPage.tsx              # Página principal
├── components/
│   ├── CampanhasSummary.tsx       # Cards de resumo (6 cards)
│   ├── CampanhasFunnelChart.tsx   # Funil vertical estilizado
│   ├── CampanhasByPlatform.tsx    # Gráfico por plataforma
│   ├── CampanhasEvolutionChart.tsx# Gráfico de evolução
│   ├── CampanhasHeatmap.tsx       # Heatmap de horários
│   ├── CampanhasTopTable.tsx      # Top campanhas (tabela)
│   └── CampanhaDetailsDialog.tsx  # Modal de detalhes
├── hooks/
│   └── useCampanhasData.ts        # Hooks de dados
└── types.ts                       # Tipos TypeScript
```

---

## Design do Funil Vertical (Destaque)

O funil será inspirado na imagem de referência, com design moderno e estilizado:

### Características Visuais

- **Layout vertical** com cards empilhados
- **Gradiente de cores** do topo (mais claro) ao fundo (mais escuro)
- **Animação suave** de hover em cada estágio
- **Conexões visuais** entre estágios (setas ou linhas)
- **Porcentagem de conversão** entre cada etapa
- **Responsivo** para diferentes tamanhos de tela

### Implementação Visual

```text
    ┌─────────────────────────────────┐
    │          Leads (86)             │  ← Barra larga
    │         ━━━━━━━━━━━             │
    └─────────────────────────────────┘
              ↓ Tx Atendimento: 6%
         ┌────────────────────────┐
         │     Contactados (5)    │  ← Barra média
         │      ━━━━━━━━━         │
         └────────────────────────┘
              ↓ Tx Qualificação: 20%
            ┌───────────────────┐
            │ Leads Qualif. (1) │  ← Barra menor
            │     ━━━━━━        │
            └───────────────────┘
              ↓ Tx Conversão: 50%
              ┌──────────────┐
              │ Qt Vendas (1)│  ← Barra mínima
              │   ━━━━       │
              └──────────────┘
```

---

## Etapas de Implementação

### Fase 1: Estrutura Base

1. Criar pasta `src/pages/estrategico/campanhas/`
2. Criar tipos TypeScript (`types.ts`)
3. Implementar hooks de dados (`useCampanhasData.ts`)
4. Criar página principal (`CampanhasPage.tsx`)

### Fase 2: Cards de Resumo

5. Implementar `CampanhasSummary.tsx`
   - 6 cards com indicadores
   - Comparativo com período anterior
   - Sparklines opcionais

### Fase 3: Funil Vertical Estilizado

6. Criar `CampanhasFunnelChart.tsx`
   - Componente visual vertical
   - Animações CSS
   - Tooltips informativos
   - Taxas de conversão entre etapas

### Fase 4: Gráficos Complementares

7. `CampanhasByPlatform.tsx` - Distribuição por fonte
8. `CampanhasEvolutionChart.tsx` - Evolução temporal
9. `CampanhasHeatmap.tsx` - Melhores horários

### Fase 5: Tabela e Detalhes

10. `CampanhasTopTable.tsx` - Ranking de campanhas
11. `CampanhaDetailsDialog.tsx` - Modal com detalhes

### Fase 6: Integração

12. Adicionar rota no `App.tsx`
13. Registrar módulo no banco de dados (menu)
14. Testes e ajustes finais

---

## Detalhes Técnicos

### Hook de Dados (`useCampanhasData.ts`)

```typescript
// Estrutura dos hooks
export function useCampanhasAgents() // Agentes disponíveis
export function useCampanhasLeads(filters) // Leads por campanha
export function useCampanhasFunnel(filters) // Dados do funil
export function useCampanhasByPlatform(filters) // Por plataforma
export function useCampanhasEvolution(filters) // Evolução temporal
export function useCampanhasHeatmap(filters) // Heatmap de horários
export function useCampanhasTop(filters) // Top campanhas
```

### Queries SQL Principais

```sql
-- Total de leads por campanha
SELECT 
  campaign_data->>'sourceID' as campaign_id,
  campaign_data->>'title' as campaign_title,
  campaign_data->>'sourceApp' as platform,
  COUNT(*) as total_leads,
  MIN(created_at) as first_lead,
  MAX(created_at) as last_lead
FROM campaing_ads
WHERE cod_agent = ANY($1::varchar[])
  AND created_at >= $2 AND created_at <= $3
GROUP BY campaign_id, campaign_title, platform
ORDER BY total_leads DESC
```

```sql
-- Funil de conversão (JOIN com CRM stages)
SELECT 
  s.name as stage_name,
  s.color as stage_color,
  s.position,
  COUNT(c.id) as count
FROM crm_atendimento_stages s
LEFT JOIN crm_atendimento_cards c ON s.id = c.stage_id
INNER JOIN campaing_ads ca ON ca.session_id::text = c.session_id::text
WHERE c.cod_agent = ANY($1::varchar[])
  AND ca.created_at >= $2 AND ca.created_at <= $3
GROUP BY s.id, s.name, s.color, s.position
ORDER BY s.position
```

### Rota no App.tsx

```typescript
// Adicionar após linha 65 (após /estrategico/contratos)
<Route path="/estrategico/campanhas" element={<CampanhasPage />} />
```

### Módulo no Menu (SQL)

```sql
INSERT INTO modules (
  code, name, menu_group, route, icon, description, is_active
) VALUES (
  'campanhas_ads', 
  'Campanhas Ads', 
  'Julia IA', 
  '/estrategico/campanhas', 
  'Megaphone', 
  'Análise estratégica de campanhas de anúncios',
  true
);
```

---

## Componente Funil: Implementação Detalhada

O funil será implementado como componente customizado usando CSS e animações:

### Características

1. **Cards verticais empilhados** com largura decrescente
2. **Cores com gradiente** baseadas nos stages do CRM
3. **Animação de entrada** com stagger effect
4. **Hover state** com elevação e highlight
5. **Indicadores de conversão** entre etapas
6. **Valores absolutos e percentuais**

### Tecnologias

- React + TypeScript
- Tailwind CSS para estilização
- CSS transitions para animações
- Recharts apenas como fallback

---

## Responsividade

| Viewport | Layout |
|----------|--------|
| Mobile (<640px) | Cards empilhados, funil compacto |
| Tablet (640-1024px) | Grid 2 colunas, funil médio |
| Desktop (>1024px) | Grid completo, funil expandido |

---

## Estimativa de Complexidade

| Componente | Complexidade | Prioridade |
|------------|--------------|------------|
| types.ts | Baixa | Alta |
| useCampanhasData.ts | Alta | Alta |
| CampanhasPage.tsx | Média | Alta |
| CampanhasSummary.tsx | Média | Alta |
| CampanhasFunnelChart.tsx | Alta | Alta |
| CampanhasByPlatform.tsx | Média | Média |
| CampanhasEvolutionChart.tsx | Média | Média |
| CampanhasHeatmap.tsx | Alta | Baixa |
| CampanhasTopTable.tsx | Média | Média |
| CampanhaDetailsDialog.tsx | Média | Baixa |
| Rota + Menu | Baixa | Alta |

---

## Considerações Finais

### Padrões Seguidos

- Uso de `UnifiedFilters` para consistência
- Hook pattern com React Query
- Multi-tenancy via `cod_agent`
- Persistência de período em localStorage
- Comparativo com período anterior
- Layout padronizado com o sistema

### Integrações

- CRM stages para funil de conversão
- Julia sessions para métricas cruzadas
- Sistema de permissões existente

### Próximos Passos (Após aprovação)

1. Criar estrutura de arquivos
2. Implementar tipos e hooks
3. Desenvolver componentes visuais
4. Integrar com rotas e menu
5. Testar end-to-end
