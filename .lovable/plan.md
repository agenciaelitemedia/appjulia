## Objetivo
Quando VOIP Call ou ZAP Call estiverem indisponíveis (sem contratação, sem ramal ou sem dispositivo conectado), os botões aparecem visíveis porém em estado desabilitado (visual esmaecido). Ao clicar, abrem um Dialog (modal) padronizado explicando que é preciso falar com o Comercial da Atende Julia.

## Novo componente

`src/components/chat/UpsellCallDialog.tsx`
- Dialog reutilizável (shadcn `Dialog`).
- Props: `open`, `onOpenChange`, `product: 'voip' | 'zap'`.
- Conteúdo dinâmico por `product`:
  - **zap**: Título "ZAP Call indisponível". Corpo: "Para habilitar o ZAP Call — módulo de ligação pelo WhatsApp — entre em contato com o Comercial da Atende Julia para contratação."
  - **voip**: Título "VOIP Call indisponível". Corpo: "Para habilitar o VOIP Call — módulo de ligação via telefonia normal (celular/telefone fixo) — entre em contato com o Comercial da Atende Julia para contratação."
- Ícone `PhoneCall`/`Phone` no header, botão único "Entendi" fechando o modal.

## Alterações

### `src/components/chat/WavoipCallButton.tsx`
- Considerar indisponível quando: `!hasActivePlan` **ou** `!ready` **ou** `!canDial` **ou** `!phone`.
- Estado visual desabilitado (opacity, cores neutras) quando indisponível.
- Ao clicar em estado indisponível: abre `UpsellCallDialog` com `product="zap"` (remove os `toast.error` de "Webphone carregando", "Sem telefone" e "Conecte dispositivo" — todos passam a exibir o mesmo modal de upsell, conforme pedido do usuário: um único modal para o estado desabilitado).
- Quando disponível: mantém fluxo atual (abre `WavoipCallDialog`).

### `src/components/chat/ChatHeader.tsx`
- Adicionar estado `showVoipUpsell`.
- Botão VOIP Call: quando `!phoneReady`, `onClick` passa a abrir `UpsellCallDialog` com `product="voip"` em vez de `setShowPhoneCall(true)`. Estilo desabilitado atual é mantido.
- Renderizar `<UpsellCallDialog product="voip" open={showVoipUpsell} .../>` no final do componente, junto ao `PhoneCallDialog` existente.
- Remover o `title` longo adicionado na iteração anterior; usar tooltip curto ("VOIP Call indisponível"), pois a explicação agora está no modal.

## Fora de escopo
- Não alterar lógica de detecção de plano/ramal/dispositivo.
- Não alterar `WavoipCallDialog` nem `PhoneCallDialog`.
- Sem mudanças de rota, backend ou permissões.