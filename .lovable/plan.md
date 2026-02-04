

# Plano: Aba de Listagem Detalhada de Campanhas

## Objetivo

Adicionar uma nova aba "Campanhas" ao modulo Campanhas Ads que exibe uma lista detalhada de todas as campanhas com:
- Thumbnail do anuncio
- Titulo e corpo/frase da campanha
- Total de leads por campanha
- Link para acessar o anuncio original
- Plataforma de origem
- Periodo de atividade

Os filtros existentes (agente, periodo, busca) serao compartilhados entre as abas.

---

## Estrutura de Abas

| Aba | Conteudo |
|-----|----------|
| **Dashboard** | Graficos, funil, heatmap (conteudo atual) |
| **Campanhas** | Grid/lista detalhada de campanhas com thumbnails |

---

## Arquitetura de Arquivos

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `CampanhasPage.tsx` | Modificar | Adicionar sistema de abas (Tabs) |
| `CampanhasListTab.tsx` | Criar | Novo componente para aba de listagem |
| `CampaignDetailCard.tsx` | Criar | Card individual de campanha com thumbnail |
| `useCampanhasData.ts` | Modificar | Adicionar hook para detalhes agregados |
| `types.ts` | Modificar | Adicionar tipo CampaignDetail |

---

## Novo Tipo: CampaignDetail

```typescript
export interface CampaignDetail {
  campaign_id: string;
  campaign_title: string;
  campaign_body: string;
  platform: string;
  source_url: string;
  media_url: string;
  thumbnail_url: string;
  conversion_source: string;
  total_leads: number;
  first_lead: string;
  last_lead: string;
  greeting_message: string;
}
```

---

## Hook: useCampanhasDetails

Query SQL para agregar campanhas com detalhes:

```sql
SELECT 
  campaign_data->>'sourceID' as campaign_id,
  campaign_data->>'title' as campaign_title,
  campaign_data->>'body' as campaign_body,
  COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
  campaign_data->>'sourceURL' as source_url,
  campaign_data->>'mediaURL' as media_url,
  campaign_data->>'thumbnailURL' as thumbnail_url,
  campaign_data->>'conversionSource' as conversion_source,
  campaign_data->>'greetingMessageBody' as greeting_message,
  COUNT(*)::int as total_leads,
  MIN(created_at) as first_lead,
  MAX(created_at) as last_lead
FROM campaing_ads
WHERE cod_agent::text = ANY($1::varchar[])
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= $2::date
  AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= $3::date
  AND campaign_data->>'sourceID' IS NOT NULL
GROUP BY 
  campaign_id, campaign_title, campaign_body, platform,
  source_url, media_url, thumbnail_url, conversion_source, greeting_message
ORDER BY total_leads DESC
```

---

## Componente: CampanhasListTab

### Layout

Grid responsivo de cards com:
- **Mobile**: 1 coluna
- **Tablet**: 2 colunas
- **Desktop**: 3-4 colunas

### Funcionalidades

1. **Busca em tempo real** - Filtra por titulo ou corpo
2. **Ordenacao** - Por leads, data, plataforma
3. **Paginacao** - 20 itens por pagina
4. **Vista Grid/Lista** - Toggle de visualizacao

---

## Componente: CampaignDetailCard

### Estrutura Visual

```text
+----------------------------------+
|  [THUMBNAIL]                     |
|  aspect-video, object-cover      |
|  Fallback: placeholder ou icone  |
+----------------------------------+
|  [Platform Badge] [Leads Badge]  |
|  "Converse conosco"  <- Titulo   |
|  "Muitos trabalhadores..."       |
|  <- Corpo truncado (2 linhas)    |
+----------------------------------+
|  Frase de Boas-vindas:           |
|  "Desejo receber meus direitos"  |
+----------------------------------+
|  [Acessar Anuncio] [Ver Leads]   |
+----------------------------------+
```

### Elementos

1. **Thumbnail**: Carrega `thumbnailURL` com fallback para placeholder
2. **Badge Plataforma**: Facebook/Instagram/Google com cores
3. **Badge Leads**: Total de leads com destaque
4. **Titulo**: Truncado em 1 linha
5. **Corpo**: Truncado em 2 linhas
6. **Frase de boas-vindas**: Texto que o lead envia
7. **Acoes**:
   - Botao "Acessar" - Abre `sourceURL` em nova aba
   - Botao "Media" - Abre `mediaURL` (video/imagem)
   - Tooltip com datas (primeiro/ultimo lead)

---

## Modificacao: CampanhasPage.tsx

Adicionar sistema de abas mantendo filtros compartilhados:

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LayoutDashboard, List } from 'lucide-react';

// No render:
<Tabs defaultValue="dashboard" className="space-y-6">
  <div className="flex items-center justify-between">
    <TabsList>
      <TabsTrigger value="dashboard">
        <LayoutDashboard className="h-4 w-4 mr-2" />
        Dashboard
      </TabsTrigger>
      <TabsTrigger value="campanhas">
        <List className="h-4 w-4 mr-2" />
        Campanhas
      </TabsTrigger>
    </TabsList>
    {/* Botao Atualizar */}
  </div>
  
  {/* Filtros - compartilhados entre abas */}
  <UnifiedFilters ... />
  
  <TabsContent value="dashboard">
    {/* Conteudo atual: Summary, Funnel, Charts, etc */}
  </TabsContent>
  
  <TabsContent value="campanhas">
    <CampanhasListTab 
      filters={filters}
      searchTerm={filters.search}
    />
  </TabsContent>
</Tabs>
```

---

## Detalhes de UI/UX

### Thumbnail com Fallback

```tsx
const ThumbnailImage = ({ url, title }) => {
  const [error, setError] = useState(false);
  
  if (error || !url) {
    return (
      <div className="aspect-video bg-muted flex items-center justify-center">
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }
  
  return (
    <img 
      src={url}
      alt={title}
      className="aspect-video object-cover w-full"
      onError={() => setError(true)}
    />
  );
};
```

### Cores por Plataforma

```typescript
const platformConfig = {
  facebook: { bg: 'bg-blue-500', icon: Facebook },
  instagram: { bg: 'bg-gradient-to-r from-purple-500 to-pink-500', icon: Instagram },
  google: { bg: 'bg-red-500', icon: Search },
  outros: { bg: 'bg-gray-500', icon: Globe },
};
```

### Acoes do Card

1. **Acessar Anuncio**: Link externo para `sourceURL`
2. **Ver Media**: Abre `mediaURL` (video/imagem do anuncio)
3. **Copiar Frase**: Copia `greetingMessageBody` para clipboard

---

## Ordem de Implementacao

### Fase 1: Tipos e Hook
1. Adicionar `CampaignDetail` em `types.ts`
2. Criar `useCampanhasDetails` em `useCampanhasData.ts`

### Fase 2: Componentes
3. Criar `CampaignDetailCard.tsx`
4. Criar `CampanhasListTab.tsx`

### Fase 3: Integracao
5. Modificar `CampanhasPage.tsx` com sistema de abas
6. Testar funcionamento completo

---

## Responsividade

| Viewport | Grid | Cards |
|----------|------|-------|
| < 640px | 1 coluna | Compactos |
| 640-1024px | 2 colunas | Medios |
| 1024-1280px | 3 colunas | Normais |
| > 1280px | 4 colunas | Expandidos |

---

## Resultado Esperado

1. Navegacao por abas entre Dashboard e Campanhas
2. Filtros compartilhados funcionando em ambas abas
3. Grid de cards com thumbnails das campanhas
4. Informacoes detalhadas: titulo, corpo, frase, leads
5. Links funcionais para acessar anuncios originais
6. Busca e ordenacao na listagem
7. Paginacao para grandes volumes de dados

