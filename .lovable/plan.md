# Geração de Protocolo Reutilizável

Hoje o protocolo é gerado por trigger no banco usando a função `generate_ticket_protocol(mask)`. Vamos expor essa geração como um **serviço reutilizável** no frontend e garantir que seja chamado no momento de salvar o ticket (não só via trigger), permitindo reuso por outros módulos (ex.: conversas, contratos futuros).

## 1. RPC no banco (reuso server-side)

A função `public.generate_ticket_protocol(p_mask text)` já existe e é `SECURITY DEFINER`. Vamos:

- Garantir `GRANT EXECUTE ... TO authenticated` (migração curta, idempotente).
- Manter o trigger `set_support_ticket_protocol` como **fallback de segurança** (se o cliente esquecer de enviar, ainda gera).

## 2. Serviço de Protocolo (frontend)

Criar `src/lib/protocol/protocolService.ts` — único ponto de geração/preview:

```ts
export type ProtocolScope = 'support_ticket'; // extensível

export const protocolService = {
  // Preview client-side (sem consumir sequencial)
  preview(mask: string, seq = 1, now = new Date()): string,

  // Geração real (consome sequencial via RPC) — chama public.generate_ticket_protocol
  async generate(mask: string): Promise<string>,

  // Helper: busca máscara salva em support_settings e gera
  async generateForSupportTicket(): Promise<string>,
};
```

- `preview` reaproveita `renderProtocolMaskPreview` (move `src/pages/tickets/lib/protocolMask.ts` para `src/lib/protocol/mask.ts` e re-exporta no caminho antigo para não quebrar imports).
- `generate` usa `supabase.rpc('generate_ticket_protocol', { p_mask })`.
- `generateForSupportTicket` faz `select protocol_mask from support_settings where id='global'` + `generate`.

## 3. Hook React

`src/lib/protocol/useProtocolPreview.ts`:

```ts
useProtocolPreview(mask: string) => { preview: string }
```

Atualizar `SupportSettingsTab.tsx` para consumir o hook (mantém a UI atual, apenas troca import).

## 4. Geração no salvar (ticket)

No fluxo de criação de ticket (`useTickets` / `createTicket` mutation):

- Antes do `insert`, chamar `protocolService.generateForSupportTicket()` e passar `protocol` no payload.
- Se falhar (rede/RPC), **não bloquear**: insere sem `protocol` e o trigger preenche.
- Em caso de retry/erro de unique no protocol, regenerar 1x.

## 5. Onde aplicar
- `src/pages/tickets/hooks/useTickets.ts` (mutation de criar ticket) — gerar antes do insert.
- `src/pages/tickets/components/SupportSettingsTab.tsx` — usar `useProtocolPreview`.
- Outros módulos que queiram protocolo no futuro importam `protocolService`.

## 6. Entregáveis
1. **Migração curta**: `GRANT EXECUTE ON FUNCTION public.generate_ticket_protocol(text) TO authenticated;`
2. **Novo módulo** `src/lib/protocol/`:
   - `mask.ts` (movido de `pages/tickets/lib/protocolMask.ts`, com re-export de compatibilidade)
   - `protocolService.ts`
   - `useProtocolPreview.ts`
   - `index.ts`
3. Ajuste em `useTickets` para chamar `generateForSupportTicket()` no create.
4. Ajuste em `SupportSettingsTab` para usar o hook.

## 7. Por que assim
- **Reuso**: qualquer módulo importa `protocolService`.
- **Confiável**: geração explícita no salvar + trigger como rede de segurança.
- **Sem duplicar lógica**: cálculo de sequencial fica 100% no Postgres (atômico via `ON CONFLICT ... RETURNING`). Frontend só orquestra e pré-visualiza.
