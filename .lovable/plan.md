
# Plano: React DebugBar (Inspirado no Laravel Debugbar)

## Visao Geral

Criar uma barra de debug para React similar ao Laravel Debugbar, que sera exibida apenas no ambiente de preview do Lovable e controlada por um toggle no Sidebar.

## Deteccao do Ambiente Lovable

A debugbar so aparecera quando a URL contiver `lovable.app` OU `localhost`:

```typescript
const isDevEnvironment = window.location.hostname.includes('lovable.app') 
  || window.location.hostname === 'localhost';
```

Isso garante que em producao (`appjulia.lovable.app` com dominio customizado) a debugbar nao apareca.

---

## Funcionalidades da DebugBar

Inspirado no Laravel Debugbar, implementaremos os seguintes coletores:

| Aba | Funcionalidade | Descricao |
|-----|----------------|-----------|
| **Queries** | SQL Logger | Todas as queries executadas via `externalDb`, tempo de execucao, parametros |
| **Network** | Requests | Chamadas fetch/axios, status, tempo de resposta |
| **State** | React Query | Cache do TanStack Query, queries ativas, stale data |
| **Timeline** | Performance | Tempo de render, navegacao entre rotas |
| **Console** | Logs | Console.log, warn, error interceptados |
| **Route** | Roteamento | Rota atual, parametros, historico de navegacao |
| **Memory** | Uso de Memoria | Performance.memory (quando disponivel) |

---

## Arquitetura

```
src/
├── components/
│   └── debug/
│       ├── DebugBar.tsx           # Componente principal (barra inferior)
│       ├── DebugBarProvider.tsx   # Context provider
│       ├── DebugBarToggle.tsx     # Toggle no sidebar
│       ├── panels/
│       │   ├── QueriesPanel.tsx   # Lista de queries SQL
│       │   ├── NetworkPanel.tsx   # Requisicoes HTTP
│       │   ├── StatePanel.tsx     # React Query cache
│       │   ├── TimelinePanel.tsx  # Performance timing
│       │   ├── ConsolePanel.tsx   # Console logs
│       │   └── RoutePanel.tsx     # Informacoes de rota
│       └── hooks/
│           ├── useQueryLogger.ts  # Hook para interceptar queries
│           ├── useNetworkLogger.ts # Hook para interceptar fetch
│           └── useConsoleLogger.ts # Hook para interceptar console
├── contexts/
│   └── DebugContext.tsx           # Estado global do debug
```

---

## Interface Visual

A DebugBar sera uma barra fixa na parte inferior da tela, similar ao Laravel Debugbar:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ [x] │ Queries (5) │ Network (12) │ State │ Timeline │ Console (2) │ Route │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  # │ Query                                  │ Time   │ Params          │
│ ───────────────────────────────────────────────────────────────────────│
│  1 │ SELECT * FROM followup_queue WHERE... │ 45ms   │ ['AG001']       │
│  2 │ SELECT * FROM agents WHERE...         │ 12ms   │ []              │
│  3 │ UPDATE followup_config SET...         │ 23ms   │ [...]           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Caracteristicas Visuais:
- Altura colapsavel (20px fechado, ate 300px expandido)
- Drag handle para redimensionar
- Abas coloridas com contadores de itens
- Badge vermelho para erros
- Botao de fechar/minimizar

---

## Toggle no Sidebar

Adicionar uma secao colapsavel no final do Sidebar:

```tsx
{isDevEnvironment && (
  <Collapsible>
    <CollapsibleTrigger className="flex items-center gap-2">
      <Bug className="w-4 h-4" />
      <span>Developer Tools</span>
      <ChevronDown className="w-3 h-3" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="flex items-center justify-between py-2">
        <span className="text-sm">DebugBar</span>
        <Switch 
          checked={debugEnabled} 
          onCheckedChange={setDebugEnabled}
        />
      </div>
    </CollapsibleContent>
  </Collapsible>
)}
```

---

## Implementacao Detalhada

### 1. DebugContext

```typescript
interface DebugState {
  enabled: boolean;
  expanded: boolean;
  activeTab: 'queries' | 'network' | 'state' | 'timeline' | 'console' | 'route';
  queries: QueryLog[];
  networkRequests: NetworkLog[];
  consoleLogs: ConsoleLog[];
  routeHistory: RouteLog[];
}

interface QueryLog {
  id: string;
  query: string;
  params: any[];
  duration: number;
  timestamp: Date;
  action: string;
  error?: string;
}

interface NetworkLog {
  id: string;
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: Date;
  requestBody?: any;
  responseBody?: any;
  error?: string;
}
```

### 2. Interceptar Queries do externalDb

Modificar `src/lib/externalDb.ts` para logar automaticamente quando debugbar ativo:

```typescript
private async invoke(payload: Record<string, any>) {
  const startTime = performance.now();
  
  try {
    const { data, error } = await supabase.functions.invoke('db-query', {
      body: payload,
    });
    
    const duration = performance.now() - startTime;
    
    // Emit to debug context
    if (window.__DEBUG_ENABLED__) {
      window.dispatchEvent(new CustomEvent('debug:query', {
        detail: {
          action: payload.action,
          query: payload.data?.query,
          params: payload.data?.params,
          duration,
          result: data,
          error: error?.message
        }
      }));
    }
    
    // ... resto do codigo
  }
}
```

### 3. Interceptar Fetch Nativo

```typescript
// Em DebugBarProvider.tsx
useEffect(() => {
  if (!enabled) return;
  
  const originalFetch = window.fetch;
  
  window.fetch = async (...args) => {
    const startTime = performance.now();
    const [url, options] = args;
    
    try {
      const response = await originalFetch(...args);
      const duration = performance.now() - startTime;
      
      addNetworkLog({
        url: url.toString(),
        method: options?.method || 'GET',
        status: response.status,
        duration,
        // Clone response para ler body sem consumir
      });
      
      return response;
    } catch (error) {
      // Log error
      throw error;
    }
  };
  
  return () => {
    window.fetch = originalFetch;
  };
}, [enabled]);
```

### 4. Interceptar Console

```typescript
useEffect(() => {
  if (!enabled) return;
  
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  
  console.log = (...args) => {
    addConsoleLog({ level: 'log', args, timestamp: new Date() });
    originalLog(...args);
  };
  
  // ... similar para warn e error
  
  return () => {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  };
}, [enabled]);
```

---

## Integracao com React Query

```typescript
// Acessar o cache do QueryClient
const queryClient = useQueryClient();

const queryCache = queryClient.getQueryCache().getAll().map(query => ({
  queryKey: query.queryKey,
  state: query.state.status,
  dataUpdatedAt: query.state.dataUpdatedAt,
  isStale: query.isStale(),
  isFetching: query.state.fetchStatus === 'fetching',
}));
```

---

## Persistencia do Estado

O estado de habilitado/desabilitado sera persistido no localStorage:

```typescript
const [enabled, setEnabled] = useState(() => {
  if (!isDevEnvironment) return false;
  return localStorage.getItem('debugbar-enabled') === 'true';
});

useEffect(() => {
  localStorage.setItem('debugbar-enabled', String(enabled));
}, [enabled]);
```

---

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/contexts/DebugContext.tsx` | Context provider para estado do debug |
| `src/components/debug/DebugBar.tsx` | Componente principal da barra |
| `src/components/debug/DebugBarToggle.tsx` | Toggle para o sidebar |
| `src/components/debug/panels/QueriesPanel.tsx` | Painel de queries SQL |
| `src/components/debug/panels/NetworkPanel.tsx` | Painel de requisicoes |
| `src/components/debug/panels/ConsolePanel.tsx` | Painel de console |
| `src/components/debug/panels/StatePanel.tsx` | Painel do React Query |
| `src/components/debug/panels/RoutePanel.tsx` | Painel de rotas |
| `src/lib/debugUtils.ts` | Utilitarios de formatacao |

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/App.tsx` | Adicionar DebugProvider e DebugBar |
| `src/components/layout/Sidebar.tsx` | Adicionar secao Developer Tools |
| `src/lib/externalDb.ts` | Adicionar emissao de eventos de query |

---

## Resultado Esperado

1. **Apenas em desenvolvimento**: A debugbar so aparece em ambientes `*.lovable.app` ou `localhost`
2. **Toggle no Sidebar**: Uma secao "Developer Tools" aparece no final do menu lateral
3. **Barra inferior**: Quando ativada, mostra uma barra com abas para diferentes coletores
4. **Queries em tempo real**: Todas as chamadas ao banco sao logadas com tempo de execucao
5. **Network inspector**: Todas as requisicoes HTTP sao capturadas
6. **Console integrado**: Logs do console aparecem na debugbar
7. **State viewer**: Visualizacao do cache do React Query
8. **Persistencia**: Estado de ativado/desativado persiste entre sessoes
