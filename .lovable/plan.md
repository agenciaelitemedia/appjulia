## Objetivo
No `Header` global, exibir sempre dois badges de status — **VOIP Call** e **ZAP Call** — visíveis, verdes quando disponíveis e cinzas (desabilitados) quando não. Ao clicar em um badge indisponível, abrir o mesmo `UpsellCallDialog` já usado no chat (mensagens de contratação do Comercial da Atende Julia).

## Alterações

### 1. `src/components/layout/HeaderDialer.tsx` (VOIP Call)
- Remover o `if (!isAvailable) return null` — o badge passa a ser sempre renderizado.
- Adicionar estado `showUpsell`.
- Duas variantes visuais do badge (o mesmo trigger de popover):
  - **Disponível** (`isAvailable` + `isRegistered`/`in-call`): estilo verde atual + label "VOIP Call" (substitui o `badgeLabel` dinâmico atual). Ícone `Phone` mantido. Ponto de status conforme `sip.status`.
  - **Indisponível** (`!isAvailable` OU estados `idle`/`error`): estilo cinza (`bg-muted text-muted-foreground border-border`, `opacity-70`), label "VOIP Call".
- Tooltip:
  - Disponível: "Ligação através de telefonia normal (celular/fixo) — disponível".
  - Indisponível: "VOIP Call indisponível — clique para saber como contratar".
- Clique quando `!isAvailable`: `setShowUpsell(true)` e **não** abre o popover do discador (envolver o botão de forma que o `PopoverTrigger` só seja usado quando disponível; quando indisponível, renderizar um `<button>` puro).
- Renderizar `<UpsellCallDialog product="voip" open={showUpsell} onOpenChange={setShowUpsell} />` no final.

### 2. Novo `src/components/layout/HeaderZapCallBadge.tsx` (ZAP Call)
- Consumir `useWavoip()` (`hasActivePlan`, `ready`, `canDial`, `devicesCount`).
- Considerar disponível quando `hasActivePlan && ready && canDial` (mesmo critério do `WavoipCallButton` sem o `phone`, pois é um indicador global).
- Badge com o mesmo formato visual do VOIP (pill: dot + `PhoneCall` + "ZAP Call"), verde quando disponível, cinza quando não.
- Tooltip:
  - Disponível: "Ligação pelo WhatsApp — disponível".
  - Indisponível: "ZAP Call indisponível — clique para saber como contratar".
- Clique:
  - Disponível: **no-op** por ora (não abre popover de discagem; ZAP Call é iniciado dentro do chat). Cursor `default`.
  - Indisponível: abre `<UpsellCallDialog product="zap" ... />`.

### 3. `src/components/layout/Header.tsx`
- Importar e renderizar `<HeaderZapCallBadge />` ao lado do `<HeaderDialer />`, dentro do container `.flex.items-center.gap-4.ml-auto`, antes do `HeaderDialer` (ou depois — manter a ordem: VOIP à esquerda do avatar, ZAP à esquerda do VOIP, seguindo o padrão do chat).

## Fora de escopo
- `WavoipContext`, `PhoneContext`, `UpsellCallDialog`, botões do `ChatHeader` — sem alterações.
- Sem mudanças de rota, backend, permissões ou lógica de detecção.
