## Objetivo
Mostrar a origem da campanha (quando existir) nos detalhes do contato dentro da conversa do `/chat`, através de uma nova aba **Campanhas** posicionada logo após **Geral**. A aba só é habilitada quando o telefone do contato tiver ao menos um registro em `campaing_ads` (banco externo já usado em `/estrategico/campanhas`).

## Onde entra
Arquivo: `src/components/chat/ContactDetailPanel.tsx` (linhas 404–421 hoje têm o `<Tabs>` com Geral / Resumos / Histórico). Vou inserir a aba **Campanhas** entre Geral e Resumos/Histórico.

## Fonte de dados
Mesmo padrão de `src/pages/estrategico/campanhas/hooks/useCampanhasLeadsList.ts`:

- Tabela externa `campaing_ads` (via `externalDb.raw`).
- Match pelo telefone do contato:
  - `COALESCE(NULLIF(campaign_data->>'phone',''), sessions.whatsapp_number::text) = <phone normalizado>`
- Não uso `cod_agent` como filtro (o `chat_contacts` não carrega esse vínculo de forma confiável). Se aparecerem múltiplos escritórios, mostro todos os registros ordenados por `created_at DESC`.

Campos exibidos por linha:
- `campaign_data->>'title'` (título)
- `campaign_data->>'body'` (descrição, se houver)
- `campaign_data->>'sourceApp'` → badge com ícone (facebook / instagram / google / outros)
- `campaign_data->>'sourceType'` (ad / organic)
- `campaign_data->>'sourceURL'` (link "Abrir anúncio")
- `campaign_data->>'thumbnailURL'` (miniatura 64x64)
- `campaign_data->>'greetingMessageBody'` (frase de entrada em blockquote)
- `campaign_data->>'sourceDevice'` (mobile/desktop)
- `created_at` formatado em BRT

## Novo hook
`src/components/chat/hooks/useContactCampaigns.ts`

```ts
useQuery(['contact-campaigns', phone], async () => {
  const query = `
    SELECT ca.id, ca.created_at,
           (ca.campaign_data::jsonb) as campaign_data
      FROM campaing_ads ca
      LEFT JOIN sessions s ON s.id = ca.session_id::int
     WHERE COALESCE(NULLIF((ca.campaign_data::jsonb)->>'phone',''),
                    s.whatsapp_number::text) = $1
     ORDER BY ca.created_at DESC
     LIMIT 50
  `;
  return externalDb.raw({ query, params: [normalizedPhone] });
}, { enabled: !!phone, staleTime: 5 * 60_000 });
```

Normalização do telefone usa `phoneNormalize` já existente no projeto (mesma lógica usada nos hooks de CRM por telefone).

## UI da aba
- `TabsTrigger value="campanhas"` com ícone `Megaphone` (lucide) + rótulo "Campanhas" + contador pequeno (ex.: `Campanhas · 2`).
- `disabled={campaigns.length === 0}` e visualmente esmaecida quando não há dados (não é escondida — segue o pedido "não habilite a aba" = trigger desabilitado).
- Conteúdo (`TabsContent value="campanhas"`):
  - `ScrollArea` seguindo padrão da aba Geral.
  - Cada registro num Card compacto:
    ```
    [thumb] Título da campanha              [badge plataforma]
            dd/MM/yyyy HH:mm · Anúncio · Mobile
            "Olá, vim pelo anúncio…"        (greeting)
            🔗 Abrir origem                 (sourceURL, target=_blank, rel=noopener)
    ```
  - Estado `isLoading`: 2 skeletons.
  - Fallback (não deveria ocorrer pois aba desabilita): "Este contato não veio de nenhuma campanha registrada."

## Ajustes no `<TabsList>`
Grid dinâmico:
```
cols = 2 (Geral, Histórico)
     + (showResumosTab ? 1 : 0)
     + (hasCampaigns ? 1 : 0)
```
Aba mantida na ordem: **Geral → Campanhas → Resumos → Histórico**. Se não houver campanhas, o trigger aparece desabilitado para deixar claro que existe a funcionalidade (comportamento equivalente a "não habilitar").

## Fora de escopo
- Nenhuma mudança de schema, migration, edge function ou backend.
- Nenhuma alteração no módulo `/estrategico/campanhas`.
- Sem gravar `campaign_data` no `chat_contacts` (busca é on-demand e cacheada por 5 min).
