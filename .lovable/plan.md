

## Plano: Ajustar Cards do Dashboard CRM

### O que muda

- **Remover** o card "Atendimentos" (card 2, que mostra média diária e total de sessões Julia)
- **Renomear** o card "WhatsApp" para "Atendimentos", mantendo o sparkline e usando `totalSessions` da Julia como valor principal em vez de `cards.length`
- **Ajustar grid** de 6 colunas para 5 colunas (`lg:grid-cols-5`), incluindo o skeleton de loading

### Resultado final — 5 cards

1. **Atendimentos** (ex-WhatsApp) — valor: `totalSessions`, subtitle: "total no período", com sparkline
2. **Tempo Médio** — sem mudança
3. **Taxa Contratos** — sem mudança
4. **Qualificados** — sem mudança
5. **Desqualificado** — sem mudança

### Arquivo

**`src/pages/crm/components/CRMDashboardSummary.tsx`**
- Remover import `Headphones`
- Remover card "Atendimentos" (linhas 127-141)
- No card "WhatsApp": renomear label para "Atendimentos", trocar valor de `stats.total` para `stats.totalSessions`
- Grid: `grid-cols-2 lg:grid-cols-5`, skeleton array de 5 itens

