
## 1. Aba "Campanhas" condicional em `ContactDetailPanel`

Atualmente a aba renderiza sempre, apenas desabilitada quando `hasCampaigns=false`. Ajustar para:
- Não renderizar `<TabsTrigger>` nem `<TabsContent>` de Campanhas quando `hasCampaigns === false`.
- Recalcular `tabsGridClass` para 2/3 colunas conforme abas realmente presentes.
- Se a aba ativa era "campanhas" e sumir, voltar para "geral" (guard no `defaultValue`).

## 2. Linha "Meta Ads" na lista de conversas

### 2.1. Novo hook `useContactsCampaignsMap(phones: string[])` em `src/components/chat/hooks/useContactCampaigns.ts`
- Recebe array de telefones dos contatos visíveis, gera variantes BR de todos.
- Uma única query `externalDb.raw` retorna `DISTINCT ON (phone_normalizado)` a campanha mais recente por telefone (usando `regexp_replace` + `ANY($1)`).
- Retorna `Map<phoneDigits, ContactCampaignRow>` para lookup O(1).
- Cache 5 min via React Query.

### 2.2. Em `ChatList.tsx`
- Extrair telefones únicos das conversas visíveis (mesmo pattern usado em `allPhoneAgentPairs`).
- Chamar `useContactsCampaignsMap` e passar `campaignLink={map.get(normalized(contact.phone))}` para cada `ChatContactItem`.

### 2.3. Em `ChatContactItem.tsx`
- Nova prop opcional `campaignLink?: ContactCampaignRow`.
- Após a linha CRM Builder, renderizar linha no mesmo padrão visual, cor âmbar/laranja (Meta):
  - Fundo: `bg-orange-50/40 dark:bg-orange-950/20`, borda `border-orange-100/70`.
  - Badge esquerda: ícone `Megaphone` + texto `META ADS`.
  - Nome da campanha truncado (`campaign_data.title`).
  - Botão à direita "Ver Ads" (badge clicável, `stopPropagation`) que abre um `<Dialog>` local exibindo o `ContactCampaignCard` (mesmo componente do painel de detalhes).
- Adicionar `campaignLink` ao `React.memo` compare.

### 2.4. Extrair `ContactCampaignCard` para arquivo próprio
- Mover de `ContactDetailPanel.tsx` para `src/components/chat/ContactCampaignCard.tsx` e exportar como default para reutilizar no dialog "Ver Ads" e no painel.

## 3. Correção do preview da imagem

O thumbnail vem de CDN do Meta (`scontent.*.fbcdn.net` / `lookaside.fbsbx.com`) que bloqueia carregamento cross-origin quando o `Referer` header expõe origem diferente. O `<img>` cai no `onError` e mostra `ImageOff`.

Ajustes no `<img>` do `ContactCampaignCard`:
- `referrerPolicy="no-referrer"` — remove header Referer que causa o bloqueio.
- `loading="lazy"` e `decoding="async"`.
- Tentar `cd.mediaURL` como fallback caso `cd.thumbnailURL` falhe (encadear: primeiro thumbnail; se erro, tentar mediaURL; se erro novamente, mostrar `ImageOff`).
- Logar em `console.warn` quando ambos falharem para telemetria.

## Detalhes técnicos

- Reutilizar `buildPhoneVariants` já existente em `useContactCampaigns.ts` para o novo hook batch.
- SQL do batch:
  ```sql
  SELECT DISTINCT ON (norm) 
         regexp_replace(COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone',''), s.whatsapp_number::text,''), '\D','','g') AS norm,
         ca.id, ca.created_at, (ca.campaign_data::jsonb) AS campaign_data
    FROM campaing_ads ca
    LEFT JOIN sessions s ON s.id = ca.session_id::bigint
   WHERE regexp_replace(...) = ANY($1::varchar[])
   ORDER BY norm, ca.created_at DESC
  ```
- No `ChatContactItem`, o botão "Ver Ads" usa `variant="outline"` `size="sm"` com `h-5 text-[9px] px-1.5` para caber na linha compacta.

## Arquivos alterados
- `src/components/chat/hooks/useContactCampaigns.ts` — novo hook batch.
- `src/components/chat/ContactCampaignCard.tsx` — novo (extraído + fix imagem).
- `src/components/chat/ContactDetailPanel.tsx` — import do card, tabs condicionais.
- `src/components/chat/ChatContactItem.tsx` — nova linha Meta Ads + dialog.
- `src/components/chat/ChatList.tsx` — hook batch e passagem da prop.
