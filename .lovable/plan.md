

# Plano atualizado: Origem da chamada + formatação + gravação + reutilização de código

## Mudanças

### 1. Centralizar lógica de discagem no `PhoneContext.dialNumber`
**`src/contexts/PhoneContext.tsx`**
- Expandir assinatura: `dialNumber(phone, contactName?, origin?: 'CRM' | 'DISCADOR', whatsappNumber?: string)`
- Enviar `metadata: { origin, whatsapp_number }` no body da action `dial`
- Toda discagem (CRM, DiscadorTab, HeaderDialer) passa por este único método — uma mudança no fluxo só precisa ser feita aqui

### 2. Chamadores passam origin e whatsapp

**`PhoneCallDialog.tsx`** — `dialNumber(whatsappNumber, contactName, 'CRM', whatsappNumber)`

**`HeaderDialer.tsx`** — `dialNumber(number, undefined, 'DISCADOR')`

**`DiscadorTab.tsx`** — Migrar para usar `dialNumber` do `PhoneContext` em vez de `dial.mutate` direto. Passar `origin: 'DISCADOR'`. Isso elimina duplicação de lógica e garante que o fluxo de enfileiramento no `syncQueueManager` e exibição do softphone é idêntico ao CRM.

### 3. Backend — propagar metadata
**`api4com-proxy/index.ts`** — action `dial`: incluir `metadata` recebido do frontend no body enviado à Api4Com (já faz isso parcialmente). O metadata volta no CDR e é salvo no `sync_call_history`.

### 4. Histórico — coluna Origem + link CRM + formatação + gravação
**`HistoricoTab.tsx`**:
- **Nova coluna "Origem"**:
  - Se `metadata.origin === 'CRM'`: ícone `LayoutDashboard` + botão clicável que navega para `/crm?whatsapp={metadata.whatsapp_number}`
  - Se `metadata.origin === 'DISCADOR'`: ícone `Phone` + texto "Discador"
  - Se sem metadata: ícone `Phone` + "Manual"
- **Formatação de números**: atualizar `formatPhone` para tratar prefixo `0` da Api4Com (`0DDNNNNNNNNN` → `(DD) NNNNN-NNNN`)
- **Botão gravação**: desabilitar se `duration_seconds === 0` ou nulo (sem duração = sem gravação útil)

## Reutilização de código
A mudança principal é que o `DiscadorTab` deixa de usar `dial.mutate` diretamente e passa a usar `dialNumber` do `PhoneContext`, assim como o CRM e o HeaderDialer já fazem. Isso significa que:
- Enfileiramento no syncQueue → feito no PhoneContext
- Exibição do softphone → feita no PhoneContext
- Metadata de origem → passada como parâmetro para o PhoneContext
- Qualquer mudança futura no fluxo de discagem/gravação/histórico precisa ser feita **apenas no PhoneContext**

## Arquivos alterados
| Arquivo | Ação |
|---|---|
| `src/contexts/PhoneContext.tsx` | Adicionar params `origin` e `whatsappNumber`, enviar no metadata |
| `src/pages/crm/components/PhoneCallDialog.tsx` | Passar `origin='CRM'` e `whatsappNumber` |
| `src/components/layout/HeaderDialer.tsx` | Passar `origin='DISCADOR'` |
| `src/pages/telefonia/components/DiscadorTab.tsx` | Migrar para `dialNumber` do PhoneContext com `origin='DISCADOR'` |
| `src/pages/telefonia/components/HistoricoTab.tsx` | Coluna origem, link CRM, formatação, gravação disabled |

