

# Plano: Atualizar Rotas do CRM e Melhorar Feedback do Botao Atualizar

## Objetivo

1. Alterar as rotas do modulo CRM para novo padrao:
   - `/leads` → `/crm/leads`
   - `/leads/monitoramento` → `/crm/lead-monitoramento`
   - `/leads/estatisticas` → `/crm/lead-estatisticas`

2. Garantir que o spinner do botao "Atualizar" seja visivel durante a atualizacao

---

## Arquivos a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/App.tsx` | Atualizar paths das rotas CRM |
| `src/components/layout/Sidebar.tsx` | Atualizar hrefs do menu CRM |
| `src/pages/crm/CRMPage.tsx` | Adicionar estado de refreshing manual |
| `src/pages/crm/components/CRMHeader.tsx` | Usar estado de refreshing para spinner |
| `src/pages/crm/monitoring/CRMMonitoringPage.tsx` | Adicionar estado de refreshing manual |
| `src/pages/crm/statistics/CRMStatisticsPage.tsx` | Adicionar estado de refreshing manual |

---

## Detalhamento das Mudancas

### 1. App.tsx - Novas Rotas

```typescript
// Antes
<Route path="/leads" element={<CRMPage />} />
<Route path="/leads/estatisticas" element={<CRMStatisticsPage />} />
<Route path="/leads/monitoramento" element={<CRMMonitoringPage />} />

// Depois
<Route path="/crm/leads" element={<CRMPage />} />
<Route path="/crm/lead-estatisticas" element={<CRMStatisticsPage />} />
<Route path="/crm/lead-monitoramento" element={<CRMMonitoringPage />} />
```

### 2. Sidebar.tsx - Atualizar Menu

```typescript
// Antes
{
  label: 'CRM',
  items: [
    { label: 'Leads', icon: Users, href: '/leads' },
    { label: 'Monitoramento', icon: BarChart3, href: '/leads/monitoramento' },
    { label: 'Estatísticas', icon: BarChart3, href: '/leads/estatisticas' },
  ],
}

// Depois
{
  label: 'CRM',
  items: [
    { label: 'Leads', icon: Users, href: '/crm/leads' },
    { label: 'Monitoramento', icon: BarChart3, href: '/crm/lead-monitoramento' },
    { label: 'Estatísticas', icon: BarChart3, href: '/crm/lead-estatisticas' },
  ],
}
```

### 3. Melhorar Feedback Visual do Botao Atualizar

O problema atual: o `isLoading` dos hooks so fica `true` no carregamento inicial. Durante um `refetch()`, o TanStack Query usa `isFetching` ao inves de `isLoading`.

**Solucao**: Criar um estado local `isRefreshing` que e ativado ao clicar e desativado quando o refetch termina.

```typescript
// Exemplo para CRMPage.tsx
const [isRefreshing, setIsRefreshing] = useState(false);

const handleRefresh = async () => {
  setIsRefreshing(true);
  await refetch();
  setIsRefreshing(false);
};

// Passar isRefreshing para o header
<CRMHeader onRefresh={handleRefresh} isLoading={isRefreshing} />
```

Aplicar o mesmo padrao para:
- `CRMMonitoringPage.tsx`
- `CRMStatisticsPage.tsx`

---

## Secao Tecnica

### Mapeamento de Rotas

| Rota Antiga | Rota Nova |
|-------------|-----------|
| `/leads` | `/crm/leads` |
| `/leads/estatisticas` | `/crm/lead-estatisticas` |
| `/leads/monitoramento` | `/crm/lead-monitoramento` |

### Fluxo do Botao Atualizar

```text
1. Usuario clica em "Atualizar"
2. setIsRefreshing(true) → spinner ativa imediatamente
3. await refetch() ou Promise.all([refetchX(), refetchY()...])
4. setIsRefreshing(false) → spinner para
```

### Garantia de Spinner Visivel

O uso de `await` garante que o spinner permanece ativo durante todo o tempo da requisicao. Para multiplos refetches, usar `Promise.all()`:

```typescript
const handleRefresh = async () => {
  setIsRefreshing(true);
  await Promise.all([
    refetchStuck(),
    refetchActivity(),
    refetchWorkload(),
    refetchBottlenecks()
  ]);
  setIsRefreshing(false);
};
```

---

## Resultado Esperado

1. **Rotas**: URLs do CRM seguem o novo padrao `/crm/*`
2. **Menu**: Links atualizados e funcionando corretamente
3. **Botao Atualizar**: Spinner visivel durante toda a duracao do refresh em todas as paginas CRM

