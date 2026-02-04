

# Plano: Melhoria na Analise de Campanhas com Agrupamento e Pagina de Redirecionamento

## Visao Geral

Implementar melhorias significativas na analise de campanhas:
1. **Agrupar campanhas** por `sourceID` + `title` (mesma campanha pode vir do Facebook E Instagram)
2. **Pagina de redirecionamento global** para evitar bloqueios de links externos
3. **Cards aprimorados** com informacoes expandiveis e multiplas fontes

---

## Parte 1: Pagina de Redirecionamento Global

### Arquivo: `src/pages/RedirectPage.tsx` (NOVO)

Pagina que recebe um link via query param e redireciona automaticamente, contornando bloqueios de navegadores/firewalls.

```tsx
// Rota: /redirect?url=<encoded_url>
// Comportamento: Exibe mensagem de redirecionamento e redireciona apos 1s
// Fallback: Botao manual caso o redirect automatico falhe
```

### Arquivo: `src/lib/externalLink.ts` (NOVO)

Utilitario global para gerar links de redirecionamento:

```typescript
export function getExternalLink(url: string): string {
  if (!url) return '#';
  return `/redirect?url=${encodeURIComponent(url)}`;
}

export function ExternalLinkButton({ href, children, ...props }) {
  // Componente que usa getExternalLink internamente
}
```

### Arquivo: `src/App.tsx` (MODIFICAR)

Adicionar rota `/redirect` apontando para `RedirectPage`.

---

## Parte 2: Novo Tipo para Campanhas Agrupadas

### Arquivo: `src/pages/estrategico/campanhas/types.ts` (MODIFICAR)

```typescript
// Informacao de cada fonte/URL da campanha
export interface CampaignSource {
  source_url: string;
  platform: 'facebook' | 'instagram' | 'google' | 'outros';
  greeting_message: string;
  device: string; // android, ios, macos, windows, etc
  lead_count: number;
  last_lead: string;
}

// Campanha agrupada
export interface CampaignDetailGrouped {
  campaign_id: string;
  campaign_title: string;
  campaign_body: string;
  thumbnail_url: string;
  media_url: string;
  
  // Agregados
  total_leads: number;
  first_lead: string;
  last_lead: string;
  
  // Multiplas fontes
  platforms: string[]; // ['facebook', 'instagram']
  devices: string[]; // ['android', 'ios', 'windows']
  sources: CampaignSource[]; // Todas as URLs/frases
  
  // Ultima frase (mais recente)
  last_greeting_message: string;
  last_source_url: string;
  
  // Agente
  cod_agent: string;
  office_name: string;
}
```

---

## Parte 3: Hook com Agrupamento

### Arquivo: `src/pages/estrategico/campanhas/hooks/useCampanhasDetails.ts` (MODIFICAR)

Nova query SQL que agrupa por `sourceID` + `title` e coleta multiplas fontes:

```sql
WITH campaign_sources AS (
  SELECT 
    campaign_data->>'sourceID' as campaign_id,
    campaign_data->>'title' as campaign_title,
    campaign_data->>'body' as campaign_body,
    COALESCE(campaign_data->>'sourceApp', 'outros') as platform,
    campaign_data->>'sourceURL' as source_url,
    campaign_data->>'mediaURL' as media_url,
    COALESCE(campaign_data->>'thumbnailURL', campaign_data->>'thumbnail') as thumbnail_url,
    campaign_data->>'greetingMessageBody' as greeting_message,
    COALESCE(campaign_data->>'sourceDevice', 'unknown') as device,
    ca.created_at,
    ca.cod_agent::text,
    COALESCE(c.name, 'Escritorio') as office_name
  FROM campaing_ads ca
  LEFT JOIN agents a ON a.cod_agent = ca.cod_agent
  LEFT JOIN clients c ON c.id = a.client_id
  WHERE ...
)
SELECT 
  campaign_id,
  campaign_title,
  campaign_body,
  MAX(thumbnail_url) as thumbnail_url,
  MAX(media_url) as media_url,
  COUNT(*)::int as total_leads,
  MIN(created_at) as first_lead,
  MAX(created_at) as last_lead,
  cod_agent,
  office_name,
  -- Agregar plataformas unicas
  ARRAY_AGG(DISTINCT platform) as platforms,
  -- Agregar devices unicos
  ARRAY_AGG(DISTINCT device) as devices,
  -- Todas as fontes como JSON
  JSON_AGG(
    JSON_BUILD_OBJECT(
      'source_url', source_url,
      'platform', platform,
      'greeting_message', greeting_message,
      'device', device,
      'created_at', created_at
    ) ORDER BY created_at DESC
  ) as sources
FROM campaign_sources
GROUP BY campaign_id, campaign_title, campaign_body, cod_agent, office_name
ORDER BY total_leads DESC
```

---

## Parte 4: Card Aprimorado

### Arquivo: `src/pages/estrategico/campanhas/components/CampaignDetailCard.tsx` (REFATORAR)

#### Layout Visual

```text
┌──────────────────────────────────────────────────────┐
│ HEADER                                               │
│ [202600000] - Joao e Matheus    [Badge: 125 leads]   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  [THUMBNAIL]                                         │
│                                                      │
│  [FB] [IG]  ← Badges de plataformas empilhados      │
│  [Android]  ← Badges de devices (icones apenas)     │
│  [iOS]                                              │
│                                                      │
├──────────────────────────────────────────────────────┤
│ TITULO: "Campanha de Trabalhistas"                   │
│                                                      │
│ BODY: "Texto da campanha que pode ser..."  [Expandir]│
│ (se muito grande, mostra truncado com botao expandir)│
│                                                      │
│ ┌─────────────────────────────────────────────────┐  │
│ │ Frase do lead:                                  │  │
│ │ "Quero meus direitos..."             [Expandir] │  │
│ │ (mostra ultima frase, expande para ver todas)   │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│ Ultimo lead: 02/02/25 as 14:30                       │
│                                                      │
│ [Acessar]  [Copiar]                                  │
│                                                      │
│ ┌─────────────────────────────────────────────────┐  │
│ │ > Ver todas as URLs (3)              [Expandir] │  │
│ │   - facebook.com/ads/123  [FB] [Android]        │  │
│ │   - instagram.com/p/xxx   [IG] [iOS]            │  │
│ │   - facebook.com/ads/456  [FB] [Windows]        │  │
│ └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

#### Componentes Internos

```tsx
// Badge de plataforma combinado
<PlatformBadges platforms={['facebook', 'instagram']} />
// Se ambos: badge com cores FB + IG lado a lado

// Badges de device (apenas icones)
<DeviceBadges devices={['android', 'ios', 'windows']} />
// Smartphone (android), Apple (ios), Monitor (windows/macos)

// Texto expandivel
<ExpandableText text={campaign.campaign_body} maxLines={2} />

// Lista de sources expandivel
<ExpandableSources sources={campaign.sources} />
```

#### Mapeamento de Devices para Icones

| Device | Icone Lucide |
|--------|--------------|
| android | `Smartphone` |
| ios | `Smartphone` (com cor diferente) |
| iphone | `Smartphone` |
| windows | `Monitor` |
| macos | `Apple` (ou `Laptop`) |
| linux | `Monitor` |
| unknown | `HelpCircle` |

---

## Parte 5: Componentes Auxiliares

### Arquivo: `src/components/ExpandableText.tsx` (NOVO)

```tsx
interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

// Mostra texto truncado com botao "Ver mais" / "Ver menos"
```

### Arquivo: `src/pages/estrategico/campanhas/components/PlatformBadges.tsx` (NOVO)

```tsx
// Renderiza badges de plataformas empilhados verticalmente
// Se multiplas, mostra cada uma em sua linha
```

### Arquivo: `src/pages/estrategico/campanhas/components/DeviceBadges.tsx` (NOVO)

```tsx
// Renderiza icones de devices empilhados verticalmente
// Apenas icones, sem texto
```

### Arquivo: `src/pages/estrategico/campanhas/components/ExpandableSources.tsx` (NOVO)

```tsx
// Lista colapsavel de todas as URLs
// Cada item mostra: URL + badge plataforma + icone device
// Botao de copiar em cada URL
```

---

## Parte 6: Integracao Global de Links Externos

### Arquivos a Modificar (usar `getExternalLink`)

| Arquivo | Links Externos |
|---------|----------------|
| `CampaignDetailCard.tsx` | `source_url`, `media_url` |
| `DesempenhoTable.tsx` | Links WhatsApp |
| `ContratosTable.tsx` | Links WhatsApp |
| `FollowupQueue.tsx` | Links WhatsApp |
| `MessageBubble.tsx` | Links em mensagens |
| `WhatsAppMessagesDialog.tsx` | Links em mensagens |
| `StuckLeadsAlert.tsx` | Links WhatsApp |
| `ContractInfoDialog.tsx` | Links WhatsApp |

---

## Ordem de Implementacao

### Fase 1: Infraestrutura Global
1. Criar `src/lib/externalLink.ts` (utilitario)
2. Criar `src/pages/RedirectPage.tsx` (pagina de redirect)
3. Adicionar rota em `App.tsx`

### Fase 2: Tipos e Hook
4. Atualizar `types.ts` com novos tipos
5. Refatorar `useCampanhasDetails.ts` com nova query

### Fase 3: Componentes Auxiliares
6. Criar `ExpandableText.tsx`
7. Criar `PlatformBadges.tsx`
8. Criar `DeviceBadges.tsx`
9. Criar `ExpandableSources.tsx`

### Fase 4: Card Principal
10. Refatorar `CampaignDetailCard.tsx`

### Fase 5: Integracao Global
11. Atualizar demais componentes para usar `getExternalLink`

---

## Detalhes Tecnicos

### SQL: Agrupamento por sourceID + title

```sql
GROUP BY 
  campaign_data->>'sourceID',
  campaign_data->>'title',
  ca.cod_agent,
  c.name
```

Isso garante que a mesma campanha (mesmo ID e titulo) vindas de Facebook E Instagram sejam agrupadas em um unico card.

### Pagina de Redirect

```tsx
useEffect(() => {
  const url = searchParams.get('url');
  if (url) {
    const timer = setTimeout(() => {
      window.location.href = url;
    }, 500);
    return () => clearTimeout(timer);
  }
}, [searchParams]);

// Fallback manual
<Button onClick={() => window.location.href = url}>
  Continuar para o site
</Button>
```

### Expansao de Texto

```tsx
const [expanded, setExpanded] = useState(false);

<div className={cn(
  "text-sm",
  !expanded && "line-clamp-2"
)}>
  {text}
</div>
{text.length > 100 && (
  <Button variant="link" size="sm" onClick={() => setExpanded(!expanded)}>
    {expanded ? 'Ver menos' : 'Ver mais'}
  </Button>
)}
```

---

## Resultado Esperado

1. Campanhas agrupadas corretamente por ID + titulo
2. Cards exibindo multiplas plataformas (FB + IG) quando aplicavel
3. Badges de devices empilhados verticalmente com icones
4. Textos longos (body, frases) expansiveis
5. Lista de todas as URLs expansivel com detalhes
6. Links externos funcionando via pagina de redirect
7. Sistema de redirect aplicado globalmente no projeto

