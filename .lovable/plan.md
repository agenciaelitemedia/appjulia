
# Correção: Duplicate DailyIframe instances are not allowed

## Diagnóstico

O Daily.js impõe uma **restrição de singleton global**: apenas uma instância de `DailyIframe` pode existir por vez em toda a aplicação. O erro ocorre quando:

1. O operador clica em "Atender" e `CustomVideoCall` monta
2. O componente chama `DailyIframe.createCallObject()` com sucesso
3. Ocorre um erro na conexão (timeout, rede, etc.)
4. O `handleError` é chamado, que dispara `onError` no pai
5. O `VideoQueuePage` executa `setActiveRoom(null)`, desmontando `CustomVideoCall`
6. O cleanup do `useEffect` tenta `call.destroy()`, mas isso é **assíncrono**
7. Antes do destroy completar, o Query `useVideoRooms` faz refetch (a cada 10s) e re-renderiza a página
8. Se o usuário clicar novamente em "Atender" (ou se algum re-render ocorrer), um novo `CustomVideoCall` monta e tenta criar outro callObject
9. **ERRO**: A instância antiga ainda existe → "Duplicate DailyIframe instances are not allowed"

## Estratégia de Correção

### A) Implementar gestão global de instância com verificação antes de criar

Em vez de confiar apenas no cleanup do useEffect, vamos:

1. **Verificar se existe instância ativa globalmente** antes de criar
2. **Destruir qualquer instância existente** antes de criar nova
3. **Usar variável global (ou módulo-level)** para rastrear a instância atual

```typescript
// Variável módulo-level para rastrear instância
let globalCallObject: ReturnType<typeof DailyIframe.createCallObject> | null = null;

// Antes de criar:
if (globalCallObject) {
  try {
    globalCallObject.leave();
    globalCallObject.destroy();
  } catch (e) {
    console.warn('Cleanup de instância anterior:', e);
  }
  globalCallObject = null;
}

// Criar nova:
globalCallObject = DailyIframe.createCallObject({ ... });
```

### B) Garantir cleanup síncrono antes de permitir nova criação

Adicionar um **debounce/lock** que impede nova criação até o destroy completar:

```typescript
const [isCleaningUp, setIsCleaningUp] = useState(false);

// No cleanup:
setIsCleaningUp(true);
await call.destroy();
setIsCleaningUp(false);

// No create:
if (isCleaningUp) {
  console.log('Aguardando cleanup...');
  return;
}
```

### C) Corrigir o fluxo de retry

O retry atual incrementa `retryKey` mas não garante que a instância anterior foi destruída. Vamos:

1. Destruir instância no início do retry (não apenas no cleanup)
2. Aguardar um pequeno delay antes de re-criar

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `CustomVideoCall.tsx` | Implementar singleton global + cleanup robusto |
| `LeadVideoCall.tsx` | Mesma correção para consistência |

## Código Proposto para CustomVideoCall.tsx

```typescript
// Variável módulo-level para rastrear instância única
let globalCallInstance: ReturnType<typeof DailyIframe.createCallObject> | null = null;

// Função helper para destruir instância existente
async function destroyExistingInstance() {
  if (globalCallInstance) {
    console.log('[CustomVideoCall] Destruindo instância anterior...');
    try {
      await globalCallInstance.leave();
      globalCallInstance.destroy();
    } catch (e) {
      console.warn('[CustomVideoCall] Erro ao destruir instância anterior:', e);
    }
    globalCallInstance = null;
  }
}

export function CustomVideoCall(...) {
  // No useEffect de criação:
  useEffect(() => {
    let mounted = true;

    const createCallObject = async () => {
      // SEMPRE destruir instância anterior primeiro
      await destroyExistingInstance();
      
      if (!mounted) return;

      try {
        const call = DailyIframe.createCallObject({
          subscribeToTracksAutomatically: true,
        });
        
        globalCallInstance = call;
        callRef.current = call;
        
        // ... resto do setup
        
        if (mounted) {
          setCallObject(call);
        }
      } catch (err: any) {
        // ...
      }
    };

    createCallObject();

    return () => {
      mounted = false;
      // Cleanup usa a função helper
      destroyExistingInstance();
    };
  }, [retryKey, handleError]);
}
```

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. Usuário clica "Atender"                                      │
│ 2. CustomVideoCall monta                                        │
│ 3. useEffect executa → destroyExistingInstance() (limpa global) │
│ 4. DailyIframe.createCallObject() → OK (não há duplicata)       │
│ 5. globalCallInstance = call                                    │
│ 6. join() é iniciado...                                         │
│                                                                  │
│ [Se ocorrer erro/timeout:]                                      │
│ 7. handleError → onError → setActiveRoom(null)                  │
│ 8. Componente desmonta → cleanup executa destroyExistingInstance│
│ 9. globalCallInstance = null                                    │
│                                                                  │
│ [Se usuário clicar "Atender" novamente:]                        │
│ 10. Novo CustomVideoCall monta                                  │
│ 11. destroyExistingInstance() confirma que não há instância     │
│ 12. createCallObject() → OK                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Verificação Pós-Implementação

1. Criar uma sala e clicar em "Atender"
2. Aguardar erro/timeout (ou forçar fechando a sala)
3. Clicar em "Atender" novamente
4. Confirmar que **não aparece** o erro "Duplicate DailyIframe"
5. Confirmar que a videochamada conecta normalmente

## Benefícios

- **Singleton garantido**: Nunca haverá duas instâncias, independente do timing
- **Cleanup robusto**: Destruição acontece antes de qualquer nova criação
- **Retry funcional**: Usuário pode tentar novamente sem F5
- **Código defensivo**: Mesmo em cenários de race condition, o erro é evitado
