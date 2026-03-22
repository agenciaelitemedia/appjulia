

# Softphone global: mesmo comportamento do CRM ao discar

## Problema
O `HeaderDialer` chama `dialNumber()` mas não ativa `setSoftphoneCentered(true)`. O softphone aparece no canto inferior direito em vez de centralizado com backdrop (como faz o CRM).

## Correção

### `src/components/layout/HeaderDialer.tsx`
Na função `handleDial`, adicionar `setSoftphoneCentered(true)` antes de chamar `dialNumber`:
```typescript
const handleDial = async () => {
  setOpen(false);
  setSoftphoneCentered(true);
  await dialNumber(number);
  setNumber('');
};
```
- Importar `setSoftphoneCentered` do `usePhone()` (já disponível no contexto)

### Arquivo alterado
- `src/components/layout/HeaderDialer.tsx` — adicionar `setSoftphoneCentered(true)` no handleDial

