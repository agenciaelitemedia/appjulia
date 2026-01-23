

# Plano: Corrigir Timezone nos Cards do CRM

## Problema Identificado

Os timestamps nos cards de leads (`CRMLeadCard.tsx`) não estão respeitando o timezone `America/Sao_Paulo`:

| Campo | Linha | Função Atual | Problema |
|-------|-------|--------------|----------|
| Criado | 116 | `format(new Date(...))` | Usa timezone do navegador |
| Atualizado | 120 | `format(new Date(...))` | Usa timezone do navegador |
| Na fase | 25 | `formatDistanceToNow(...)` | Usa timezone do navegador |

---

## Solução

Substituir as chamadas `format()` por `toLocaleString()` com timezone explícito, seguindo o padrão já implementado no `WhatsAppMessagesDialog.tsx`.

### Antes (incorreto):
```typescript
format(new Date(card.created_at), "dd/MM/yy, HH:mm", { locale: ptBR })
```

### Depois (correto):
```typescript
new Date(card.created_at).toLocaleString('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})
```

---

## Alterações no Arquivo

### `src/pages/crm/components/CRMLeadCard.tsx`

1. **Criar função helper para formatação consistente:**

```typescript
function formatDateTimeSaoPaulo(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
```

2. **Atualizar linha 116 (Criado):**
```typescript
<span>{formatDateTimeSaoPaulo(card.created_at)}</span>
```

3. **Atualizar linha 120 (Atualizado):**
```typescript
<span>{formatDateTimeSaoPaulo(card.updated_at)}</span>
```

4. **Para o "Na fase" (linha 25):** 
O `formatDistanceToNow` calcula diferença relativa, então o timezone do input importa. Precisamos garantir que a comparação seja feita corretamente:

```typescript
// A função formatDistanceToNow usa Date.now() internamente
// Como estamos comparando diferença, o importante é que ambas as datas
// estejam no mesmo timezone (ambas UTC ou ambas locais)
// O date-fns lida corretamente com isso, mas para consistência visual
// podemos manter como está já que mostra "há X tempo"
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/components/CRMLeadCard.tsx` | Adicionar função helper e usar timezone explícito nas datas |

---

## Resultado Esperado

- Datas "Criado" e "Atualizado" exibirão corretamente no fuso de São Paulo
- Consistência com o timezone usado no popup de mensagens do WhatsApp
- Mesmo usuário acessando de diferentes fusos verá sempre o horário de Brasília

