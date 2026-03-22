

# Problema: tipo incompatível entre `user.id` e `assigned_member_id`

## Causa raiz

O `user.id` armazenado no localStorage (vindo do banco externo) pode estar como **string** `"158"`, enquanto `assigned_member_id` retornado pelo Supabase é **number** `158`. A comparação estrita `===` entre string e number retorna `false`:

```javascript
"158" === 158  // false
```

Por isso `myExtension` é sempre `null` e o discador mostra "Indisponível".

## Correção

### `DiscadorTab.tsx` — usar comparação numérica
Trocar `e.assigned_member_id === user.id` por `Number(e.assigned_member_id) === Number(user.id)` em todos os locais:

1. No `useMemo` de `myExtension` (linha ~55)
2. No `handleCallEnded` (linha ~34)

### `PhoneCallDialog.tsx` — mesma correção
Trocar a comparação equivalente para usar `Number()`.

## Arquivos alterados
- `src/pages/telefonia/components/DiscadorTab.tsx` — 2 comparações
- `src/pages/crm/components/PhoneCallDialog.tsx` — comparação equivalente

