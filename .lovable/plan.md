

# Separar grupos monitorados/não monitorados + Extrair cod_agent do nome

## Resumo

Duas mudanças no `SupportGroupsTab.tsx`:
1. Separar a listagem em duas seções: **Monitorados** (primeiro, com card verde diferenciado) e **Não Monitorados** (abaixo, card padrão)
2. Extrair automaticamente o `cod_agent` do nome do grupo usando regex para o padrão `[YYYYMMDD]`

## 1. Separação visual Monitorados vs Não Monitorados

No `filteredGroups`, dividir em dois arrays:
```typescript
const monitoredGroups = filteredGroups.filter(g => monitoredJids.has(g.jid));
const unmonitoredGroups = filteredGroups.filter(g => !monitoredJids.has(g.jid));
```

Renderizar em duas seções com headers:
- **"Monitorados (X)"** — cards com borda/fundo verde (`border-green-200 bg-green-50/50 dark:bg-green-950/20`)
- **"Não Monitorados (Y)"** — cards com estilo padrão atual

## 2. Extração do cod_agent do nome do grupo

Função helper com regex:
```typescript
const extractCodAgent = (groupName: string): string | null => {
  const match = groupName.match(/\[(20\d{6})\]/);
  return match ? match[1] : null;
};
```

Exibir como Badge ao lado do nome do grupo quando encontrado (ex: `Badge "20250405"`).

Adicionar `codAgent` ao `GroupInfo` interface e preencher no `normalizeGroup`.

## 3. Contadores no header

Atualizar o header para mostrar: `Grupos (X total) — Y monitorados · Z não monitorados`

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `SupportGroupsTab.tsx` | Separar seções monitorados/não monitorados, estilizar cards, extrair cod_agent |

