
# Correção: Página de Videochamada para Leads Travada em "Conectando..."

## Problema Identificado

A página `/call/:roomName` fica mostrando "Conectando..." infinitamente porque:

1. **O overlay de loading bloqueia a interface do Daily.co** - O overlay com z-index 10 cobre o iframe
2. **O status só muda para "connected" quando entra na chamada** - Mas o Daily.co tem uma tela de pré-entrada (prejoin) onde o usuário escolhe câmera/microfone antes de entrar
3. **O container do iframe não tem altura fixa** - Pode causar problemas de renderização

## Solução Proposta

### 1. Remover o overlay durante a fase "joining"

O overlay de "Conectando..." deve desaparecer assim que o iframe for criado, permitindo que o usuário veja a interface do Daily.co para configurar câmera/microfone.

### 2. Usar evento "loaded" do Daily.co

O Daily.co dispara um evento `loading` que indica quando a interface está pronta. Vamos usar isso para ocultar o loading.

### 3. Garantir altura do container

O container precisa ter uma altura mínima definida para que o iframe seja exibido corretamente.

## Alterações no Código

### Arquivo: `src/pages/video/JoinCallPage.tsx`

**Mudanças:**

1. Adicionar evento `loading` para detectar quando iframe está pronto
2. Mudar o status para "connected" assim que o iframe carregar (não esperar joined-meeting)
3. Ou simplesmente remover o overlay quando estiver na fase "joining"

```tsx
// ANTES - Overlay bloqueia interface
{status === 'joining' && (
  <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
    <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
    <p>Conectando...</p>
  </div>
)}
<div ref={containerRef} className="flex-1 w-full" />

// DEPOIS - Remover overlay ou usar z-index menor, e garantir altura
<div 
  ref={containerRef} 
  className="flex-1 w-full min-h-screen"
/>
// Loading apenas no estado inicial "loading", não em "joining"
```

**Alternativa mais simples:** Remover o overlay "Conectando..." durante joining e deixar o Daily.co mostrar sua própria interface de loading/prejoin.

## Fluxo Corrigido

```text
┌────────────────────────────────────────────────────────────────────┐
│                        FLUXO ATUAL (PROBLEMA)                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Lead abre link                                                   │
│  2. Status: "loading" → Mostra spinner                               │
│  3. API retorna URL da sala                                          │
│  4. Status: "joining" → Overlay "Conectando..." BLOQUEIA o iframe    │
│  5. Daily.co cria iframe (por baixo do overlay, invisível)           │
│  6. Usuário NÃO consegue ver/interagir com Daily.co                  │
│  7. Status fica "joining" eternamente                                │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                        FLUXO CORRIGIDO                              │
├────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. Lead abre link                                                   │
│  2. Status: "loading" → Mostra spinner                               │
│  3. API retorna URL da sala                                          │
│  4. Status: "joining" → Iframe Daily.co visível                      │
│  5. Daily.co mostra tela prejoin (câmera/mic)                        │
│  6. Usuário interage e entra na chamada                              │
│  7. Status: "connected" quando joined-meeting dispara                │
│                                                                      │
└────────────────────────────────────────────────────────────────────┘
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/video/JoinCallPage.tsx` | Remover overlay durante "joining"; garantir altura do container |

## Detalhes Técnicos

A correção é simples: quando o status é "joining", não mostramos mais o overlay. O Daily.co tem sua própria interface de loading e pré-entrada que é melhor para a experiência do usuário.

```tsx
// Remover completamente o bloco:
{status === 'joining' && (
  <div className="absolute ...">
    ...
  </div>
)}

// E garantir que o container tenha altura
<div 
  ref={containerRef} 
  className="flex-1 w-full min-h-screen"
/>
```

## Nota sobre o Link Testado

O link `https://acesso.atendejulia.com.br/call/julia-20240038-1769679431244` mostra "Sala não encontrada ou expirada" porque essa sala foi **deletada** quando você clicou "Atender" antes da correção anterior. 

O sistema agora está funcionando corretamente para salas existentes - só precisamos corrigir esse overlay para que a interface do Daily.co apareça.
