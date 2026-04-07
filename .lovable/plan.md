

# Ajustes nos Cards de Contratos e Filtros do Advogado

## Alterações

### 1. `src/pages/adv/components/AdvContratosCards.tsx` — Refatorar cards

- Remover icone de chat (MessageCircle) completamente
- Icone de telefone: mostrar apenas se `isAvailable` do `PhoneContext` for `true` (importar `usePhone`)
- Abaixo do resumo do caso, adicionar linha "Ligue Agora:" + telefone formatado `(XX) XXXXX-XXXX`
  - Formatar o `contrato.whatsapp` para exibição: extrair DDD e número, formato `(XX) XXXXX-XXXX`
  - Se não houver telefone, não exibir a linha
- Receber `hasPhone` como prop (ou usar context direto no componente)

### 2. `src/pages/adv/AdvDashboardPage.tsx` — Simplificar filtros

- Remover o `showStatusFilter` e `statusOptions` do `UnifiedFilters`
- Reduzir períodos rápidos: passar apenas Hoje, Ontem, 7 Dias, Mês Atual
- Manter datas início/fim
- Adicionar badges de status (Assinado / Em Curso) como filtro toggle no lugar do select de status
  - Usar estado local para status selecionados
  - Filtrar contratos no frontend com base nos badges ativos
- Remover busca (`showSearch={false}` já está)

### Detalhes técnicos

**Formato de telefone para exibição:**
```typescript
function formatPhoneDisplay(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('55') && digits.length >= 12) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) {
    return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
  return raw;
}
```

**Badges de status no dashboard:**
- Dois badges clicáveis: "Em Curso" (amarelo) e "Assinado" (verde)
- Ambos ativos por padrão
- Clicar toggle a visibilidade daquela categoria
- Filtragem aplicada antes de passar contratos para os componentes

**Telefonia condicional:**
- Importar `usePhone` do `PhoneContext` no `AdvContratosCards`
- Checar `isAvailable` para mostrar/esconder o botão de ligar

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/adv/components/AdvContratosCards.tsx` | Remover chat, condicionar telefone, adicionar "Ligue Agora" |
| `src/pages/adv/AdvDashboardPage.tsx` | Reduzir períodos, trocar select status por badges toggle |

