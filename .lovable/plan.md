

## Ajuste de cores dos estágios dos funis

Alterar as cores dos 5 estágios em dois arquivos para:

| Estágio | Cor atual | Nova cor |
|---------|-----------|----------|
| Atendimentos | #3b82f6 (azul) | #22c55e (verde) |
| Em Qualificação | #22c55e (verde) | #eab308 (amarelo) |
| Qualificados | #eab308 (amarelo) | #f97316 (laranja) |
| Contratos Gerados | #f97316 (laranja) | #3b82f6 (azul) |
| Contratos Assinados | #8b5cf6 (roxo) | #8b5cf6 (mantém) |

### Arquivos alterados

1. **`src/pages/dashboard/hooks/useDashboardFunnels.ts`** — Atualizar as cores nos dois blocos UNION ALL (Julia funnel linhas ~87-93 e Campaign funnel linhas ~186-190)

2. **`src/pages/dashboard/components/DashboardTripleFunnel.tsx`** — Atualizar o array `STAGE_COLORS` usado pelo funil Orgânicos (linha ~119)

