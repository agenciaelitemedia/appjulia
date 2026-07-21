# Unificar topbar do BlitzLeads

Hoje existem duas barras empilhadas: a `BlitzTopbar` (busca + sino, dentro do `BlitzLayout`) e o "Apphead" interno do `CallCenterPage` (crumb "Operação" + título "Call Center · Recuperação"). O objetivo é ficar com **apenas uma barra**, contendo o título, a busca e o sino de alertas, e trocar o texto fixo pelo **nome do escritório** (client) do usuário logado — na mesma tipografia atual do título.

## Mudanças

### 1. Novo hook `src/blitzleads/hooks/useBlitzClient.ts`
Wrapper fino sobre `useAuth()` (respeitando a regra "sempre estender via arquivo dentro de `src/blitzleads/`"). Retorna:
- `clientId: string | null` — de `user.client_id`
- `clientName: string | null` — de `user.client_name` (já preenchido pelo `AuthContext` a partir de `clients.name`)
- `fallbackName` = `"Escritório"` quando ainda carregando

Fica pronto para no futuro consultar tabelas `blitzleads_*` sem alterar as páginas.

### 2. `src/blitzleads/components/BlitzTopbar.tsx`
Absorve o "Apphead":
- À esquerda, antes da busca, adicionar bloco:
  - crumb `Operação` (12px, `#94a3b8`)
  - `<h1>` 16px extrabold `#0f172a` com o **nome do escritório** vindo do `useBlitzClient()` — mesma classe/tokens do título atual do CallCenter (`text-[16px] font-extrabold tracking-[-0.01em] leading-none`)
- Mantém busca central e sino/dropdown de alertas à direita (sem mudanças de comportamento).
- Altura continua 56px, borda inferior `#e2e8f0`, fundo branco, sticky.

### 3. `src/blitzleads/pages/CallCenterPage.tsx`
Remover completamente o `<header>` interno (linhas ~155–175), incluindo o crumb "Operação", o `<h1>Call Center · Recuperação</h1>` e o chip "N casos vencidos".

O chip "casos vencidos" fica fora de escopo desta mudança (o usuário só pediu para unir as duas barras); se quisermos preservar essa informação, ela já aparece no card "SLA estourado" logo abaixo.

### 4. Sem mudanças em `BlitzLayout.tsx`
A `BlitzTopbar` continua sendo renderizada uma única vez pelo layout — como agora só existe ela, sobra apenas uma barra em toda a área `/BlitzLead/*`.

## Detalhes técnicos

- `useAuth()` já expõe `client_name` (via `AuthContext.tsx` linha 106) hidratado da tabela `clients` externa; não precisa nova query.
- O hook novo importa `useAuth` de `@/contexts/AuthContext` — é o único acoplamento externo permitido pela arquitetura do módulo.
- Nenhuma mudança de rota, banco ou edge function.

## Fora de escopo

- Aplicar o mesmo cabeçalho unificado no `CaseDetailPage` (pode ser feito num passo seguinte se desejado).
- Buscar dados extras do escritório (logo, plano) — o hook fica preparado, mas só usa `client_name` agora.
