

# Plano: SyncQueue global + Softphone global com discador no Header

## Problema atual
1. O `useSyncQueue` é um hook React — morre quando o componente desmonta (troca de página)
2. O softphone/SIP só existe dentro da página de Telefonia ou do PhoneCallDialog — não persiste entre páginas
3. Não há ícone global para acessar o softphone de qualquer lugar

## Arquitetura proposta

### 1. SyncQueue como singleton global (fora do React)
Criar `src/lib/syncQueueManager.ts` — um módulo singleton puro (não hook):
- Fila em memória com `setInterval` que roda independente de componentes React
- Métodos: `init(codAgent)`, `enqueue(callId)`, `destroy()`
- Usa `supabase.functions.invoke` diretamente
- Dispara evento customizado `window.dispatchEvent(new Event('sync-queue-done'))` para os componentes React invalidarem queries
- Inicializado uma vez no `MainLayout` ao montar

O hook `useSyncQueue` vira um wrapper fino que chama o singleton e escuta o evento para invalidar queries.

### 2. Contexto global de Telefonia (`PhoneProvider`)
Novo contexto `src/contexts/PhoneContext.tsx`:
- Encapsula `useSipPhone` + conexão automática do ramal do usuário
- Busca `phone_extensions` do usuário logado (todos os `cod_agent`)
- Auto-conecta SIP se encontrar ramal ativo
- Expõe: `sip` (status, duration, etc.), `dial(number)`, `myExtension`, `codAgent`, `isAvailable`, `showSoftphone`, `setShowSoftphone`
- O `syncQueueManager` é inicializado aqui com o `codAgent`

### 3. Softphone global no MainLayout
- Renderizar `SoftphoneWidget` no `MainLayout` (ao lado do `CopilotWidget`), controlado pelo `PhoneContext`
- Quando em chamada ativa: exibir no canto inferior direito (modo minimizado/expandido)
- Quando centralizado (chamada CRM): usar modo centered com backdrop

### 4. Ícone no Header com discador
No `Header.tsx`, adicionar botão de telefone (ao lado do sino de notificações):
- Visível apenas se `isAvailable` (usuário tem ramal)
- Indicador de status (bolinha verde/vermelha)
- Ao clicar: abre popover/dropdown com:
  - Status SIP atual
  - Input para digitar número
  - Botão "Ligar"
  - Teclado DTMF simplificado
- Se já em chamada: mostra controles da chamada ativa

### 5. Ajustar PhoneCallDialog (CRM)
- Remover instância local de `useSipPhone` e `useSyncQueue`
- Usar `PhoneContext` para discar e controlar softphone
- Ao clicar "Ligar": fechar dialog, chamar `dial(number)` do contexto, que ativa o softphone centralizado

### 6. Ajustar DiscadorTab (Telefonia)
- Remover instância local de `useSipPhone`
- Usar `PhoneContext` para estado SIP e discagem
- Manter UI de diagnóstico e seleção de ramal como override local se necessário

## Arquivos

| Arquivo | Ação |
|---|---|
| `src/lib/syncQueueManager.ts` | **Novo** — singleton da fila de sync |
| `src/contexts/PhoneContext.tsx` | **Novo** — contexto global de telefonia |
| `src/components/layout/MainLayout.tsx` | Envolver com `PhoneProvider`, renderizar softphone global |
| `src/components/layout/Header.tsx` | Adicionar ícone telefone + popover discador |
| `src/pages/crm/components/PhoneCallDialog.tsx` | Usar PhoneContext em vez de SIP/sync locais |
| `src/pages/telefonia/components/DiscadorTab.tsx` | Usar PhoneContext |
| `src/pages/telefonia/hooks/useSyncQueue.ts` | Wrapper do singleton |

## Fluxo do usuário
```text
Login → MainLayout monta → PhoneProvider busca ramal → auto-conecta SIP
                                                     → inicializa syncQueueManager

Qualquer página → Header mostra ícone 📞 (verde se SIP ativo)
                → Clica → Popover com discador → Digita número → Ligar
                → Softphone aparece no canto inferior direito

CRM → Card → Ligar → PhoneCallDialog → "Ligar" → fecha dialog
   → Softphone centralizado (backdrop) → chamada → desliga
   → syncQueue.enqueue(callId) → sync em background

Troca de página → SIP continua ativo, sync continua rodando
```

