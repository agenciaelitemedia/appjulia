

# Layout Full-Screen com Abas Painel / Contratos

## Resumo

Reestruturar `/adv/dashboard` para usar 100% da tela, com duas abas fixas (Painel e Contratos). O filtro fica acima das abas (compartilhado). A aba Painel mostra summary + chart. A aba Contratos mostra cards agrupados por status (Em Curso vs Assinados) com ações de ligar, chat e detalhes.

## Alterações

### 1. `src/pages/adv/AdvDashboardPage.tsx` — Reescrever

- Remover `max-w-2xl` e usar `w-full` para ocupar 100% da tela
- Adicionar tabs (Painel / Contratos) usando `Tabs` do shadcn
- Header + filtros ficam fora das tabs (sempre visíveis)
- **Aba Painel**: `ContratosSummary` + `ContratosEvolutionChart` (sem tabela)
- **Aba Contratos**: novo componente de cards

### 2. `src/pages/adv/components/AdvContratosCards.tsx` — Novo

Componente mobile-first que renderiza contratos em cards separados por status:

- **Seção "Em Curso"** (status `CREATED`, `PENDING`) — badge amarelo/laranja
- **Seção "Assinados"** (status `SIGNED`) — badge verde
- Cada seção com header + contagem
- Card mostra: nome do cliente, data, status badge, resumo do caso (truncado)
- Ações em cada card (ícones circulares):
  - **Ligar** (Phone, laranja) — abre `PhoneCallDialog`
  - **WhatsApp** (MessageCircle, verde) — abre link `wa.me`
  - **Detalhes** (Eye, azul) — abre `ContratoDetailsDialog`
- Cards com `CANCELLED` ficam em seção colapsável "Cancelados" no final
- Skeleton loading com cards placeholder

### 3. `src/components/layout/AdvLayout.tsx` — Ajuste menor

- Garantir que `main` use `flex-1 overflow-auto` sem padding extra (já está ok)

## Estrutura visual (mobile 390px)

```text
┌──────────────────────────┐
│ Logo    Nome    [Logout] │  ← header fixo
├──────────────────────────┤
│ [Filtro período/status]  │  ← filtros compartilhados
├──────────────────────────┤
│  [Painel]  [Contratos]   │  ← tabs
├──────────────────────────┤
│                          │
│  (conteúdo da aba ativa) │
│                          │
└──────────────────────────┘
```

### Card de contrato (aba Contratos):
```text
┌─────────────────────────────┐
│ João Silva        ● Em Curso│
│ 15/03/2026 · Direito Civil  │
│ Resumo truncado do caso...  │
│                             │
│  [📞]  [💬]  [👁]           │
└─────────────────────────────┘
```

## Arquivos

| Arquivo | Mudança |
|---|---|
| `src/pages/adv/AdvDashboardPage.tsx` | Reescrever com tabs e layout full-width |
| `src/pages/adv/components/AdvContratosCards.tsx` | **Novo** — cards de contratos com agrupamento por status e ações |

