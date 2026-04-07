

# Corrigir erro PhoneProvider + Adicionar busca na aba Contratos

## Problema 1: `usePhone must be used within PhoneProvider`
O `AdvLayout` não envolve o conteúdo com `PhoneProvider`. O `MainLayout` faz isso, mas o layout do advogado é independente.

## Problema 2: Sem busca na aba Contratos
Precisa de um campo de busca por nome, código, CPF ou telefone do cliente.

## Alterações

### 1. `src/components/layout/AdvLayout.tsx`
Envolver o conteúdo com `PhoneProvider`:
```tsx
import { PhoneProvider } from '@/contexts/PhoneContext';
// ...
return (
  <PhoneProvider>
    <div className="min-h-[100dvh] ...">
      ...
    </div>
  </PhoneProvider>
);
```

### 2. `src/pages/adv/AdvDashboardPage.tsx`
Adicionar campo de busca textual que filtra contratos na aba Contratos:
- Input com placeholder "Buscar por nome, CPF, telefone..."
- Posicionar entre os badges de status e as tabs
- Filtrar `filteredContratos` adicionalmente pelo texto de busca, comparando contra `signer_name`, `name`, `cpf`, `whatsapp`, `cod_document`
- Usar debounce de 300ms para performance

| Arquivo | Mudança |
|---|---|
| `src/components/layout/AdvLayout.tsx` | Envolver com `PhoneProvider` |
| `src/pages/adv/AdvDashboardPage.tsx` | Adicionar input de busca textual com filtro local |

