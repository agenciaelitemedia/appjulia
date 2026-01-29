

# Plano de Correção: Videochamada Travando em "Entrando na chamada..."

## Diagnóstico do Problema

### Causa Raiz Identificada

O evento `joined-meeting` nunca dispara no componente interno (`VideoCallContent` / `LeadCallContent`) porque existe uma **condição de corrida** (race condition):

```text
Fluxo Atual (Problemático):
┌─────────────────────────────────────────────────────────────────┐
│ 1. useEffect executa                                            │
│ 2. call.join() é chamado                                        │
│ 3. EVENTO "joined-meeting" DISPARA (ainda não há listener!)     │
│ 4. await call.join() retorna                                    │
│ 5. setCallObject(call) → monta DailyProvider                    │
│ 6. useDailyEvent('joined-meeting', ...) registra listener       │
│ 7. ❌ Listener está pronto, mas evento já passou                │
│ 8. isConnected permanece false → tela trava                     │
└─────────────────────────────────────────────────────────────────┘
```

O `useDailyEvent` só funciona para eventos **futuros**. Como o evento `joined-meeting` é disparado **durante** o `call.join()`, e o `DailyProvider` só monta **depois** que o join completa, o listener nunca recebe o evento.

## Solução Proposta

Usar o hook `useMeetingState()` da biblioteca `@daily-co/daily-react` em vez de depender do evento `joined-meeting`. Este hook retorna o estado atual da reunião de forma síncrona, eliminando a race condition.

```text
Estados Possíveis (DailyMeetingState):
- 'new'            → Call object criado, não conectado
- 'loading'        → Carregando recursos
- 'loaded'         → Recursos carregados
- 'joining-meeting' → Conectando à sala
- 'joined-meeting' → ✅ Conectado com sucesso
- 'left-meeting'   → Saiu da chamada
- 'error'          → Erro na conexão
```

### Fluxo Corrigido

```text
Fluxo Novo (Correto):
┌─────────────────────────────────────────────────────────────────┐
│ 1. useEffect executa                                            │
│ 2. call.join() é chamado                                        │
│ 3. await call.join() retorna                                    │
│ 4. setCallObject(call) → monta DailyProvider                    │
│ 5. useMeetingState() retorna 'joined-meeting' imediatamente     │
│ 6. ✅ isConnected = true → vídeo renderiza                       │
└─────────────────────────────────────────────────────────────────┘
```

## Alterações por Arquivo

### 1. CustomVideoCall.tsx (Operador)

**Alterar o componente `VideoCallContent`:**

Antes (problemático):
```typescript
function VideoCallContent({ onLeave }: { onLeave: () => void }) {
  const [isConnected, setIsConnected] = useState(false);

  useDailyEvent('joined-meeting', () => {
    setIsConnected(true);  // ❌ Nunca executa - evento já passou
  });

  useDailyEvent('left-meeting', () => {
    onLeave();
  });

  if (!isConnected) {
    return <LoadingSpinner />;
  }
  // ...
}
```

Depois (correto):
```typescript
import { useMeetingState } from '@daily-co/daily-react';

function VideoCallContent({ onLeave }: { onLeave: () => void }) {
  const meetingState = useMeetingState();

  // Detectar saída via evento (ainda necessário para callback)
  useDailyEvent('left-meeting', useCallback(() => {
    onLeave();
  }, [onLeave]));

  // Estado derivado diretamente do hook
  const isConnected = meetingState === 'joined-meeting';

  if (!isConnected) {
    return <LoadingSpinner />;
  }
  // ...
}
```

### 2. LeadVideoCall.tsx (Lead)

**Mesma correção no componente `LeadCallContent`:**

Antes (problemático):
```typescript
function LeadCallContent({ onLeave }: { onLeave: () => void }) {
  const [isConnected, setIsConnected] = useState(false);

  useDailyEvent('joined-meeting', () => {
    setIsConnected(true);  // ❌ Nunca executa
  });
  // ...
}
```

Depois (correto):
```typescript
import { useMeetingState } from '@daily-co/daily-react';

function LeadCallContent({ onLeave }: { onLeave: () => void }) {
  const meetingState = useMeetingState();

  useDailyEvent('left-meeting', useCallback(() => {
    onLeave();
  }, [onLeave]));

  const isConnected = meetingState === 'joined-meeting';

  if (!isConnected) {
    return <LoadingSpinner />;
  }
  // ...
}
```

## Detalhes Técnicos

### Por que `useMeetingState` funciona?

O hook `useMeetingState()` lê o estado **atual** do call object via `callObject.meetingState()`. Não depende de eventos - consulta o estado diretamente. Portanto:

- Quando o `DailyProvider` monta com um call object já conectado, `useMeetingState()` retorna `'joined-meeting'` imediatamente
- Não há condição de corrida porque não depende de timing de eventos

### Callback do useDailyEvent

O `useDailyEvent` requer callbacks memoizados (via `useCallback`). Será adicionado `useCallback` no handler de `left-meeting` para evitar warnings no console:

```typescript
useDailyEvent('left-meeting', useCallback(() => {
  onLeave();
}, [onLeave]));
```

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `src/pages/video/components/CustomVideoCall.tsx` | Substituir `useDailyEvent('joined-meeting')` por `useMeetingState()` |
| `src/pages/video/components/LeadVideoCall.tsx` | Mesma correção |

## Verificação Pós-Implementação

1. Criar uma nova sala via CRM
2. Copiar o link e abrir em aba anônima (simula lead)
3. Verificar se o lead vê a tela de vídeo (não mais "Entrando na chamada...")
4. Clicar em "Em atendimento" no painel do operador
5. Verificar se o operador vê a tela de vídeo (não mais "Conectando...")
6. Verificar se ambos veem o vídeo um do outro
7. Encerrar a chamada e verificar se o histórico é registrado

