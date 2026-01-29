
# Plano: Ajustar Tamanho das Telas de Vídeo e Remover Branding do Daily.co

## Problemas Identificados

### 1. Tela de Vídeo Pequena
Com base no screenshot, o vídeo aparece em uma área pequena porque:
- **VideoCallEmbed.tsx**: O container tem `min-h-[400px]`, que é muito pequeno
- **JoinCallPage.tsx**: Apesar de ter `min-h-screen`, o iframe dentro pode não estar ocupando todo o espaço

### 2. "Powered by Daily" Aparecendo
A faixa verde "Powered by Daily" aparece no topo da chamada. Isso é controlado pela propriedade `hide_daily_branding`.

Segundo a documentação oficial do Daily.co:
> **`hide_daily_branding`** (boolean) - [Pay-as-you-go] - Whether "Powered by Daily" displays in the in-call UI. Default: false

**Importante**: Esta opção requer um plano pago ("Pay-as-you-go"). No plano gratuito, não é possível remover o branding via API.

## Soluções

### Solução 1: Aumentar o tamanho do vídeo

#### Arquivo: `src/pages/video/components/VideoCallEmbed.tsx`
Aumentar a altura mínima do container do vídeo de `min-h-[400px]` para ocupar toda a área disponível:

```tsx
// ANTES
<div 
  ref={containerRef} 
  className="w-full h-full min-h-[400px] bg-muted"
/>

// DEPOIS
<div 
  ref={containerRef} 
  className="w-full h-full min-h-[calc(100vh-200px)] bg-muted"
/>
```

E ajustar o Card pai para ocupar altura total:

```tsx
// ANTES
<Card className={cn("flex flex-col", isFullscreen && "fixed inset-0 z-50 rounded-none")}>

// DEPOIS  
<Card className={cn("flex flex-col h-full min-h-[calc(100vh-200px)]", isFullscreen && "fixed inset-0 z-50 rounded-none")}>
```

#### Arquivo: `src/pages/video/JoinCallPage.tsx`
Garantir que o container ocupe 100% da viewport:

```tsx
// ANTES
return (
  <div className="min-h-screen bg-background flex flex-col">
    <div 
      ref={containerRef} 
      className="flex-1 w-full min-h-screen"
    />
  </div>
);

// DEPOIS
return (
  <div className="h-screen w-screen bg-background overflow-hidden">
    <div 
      ref={containerRef} 
      className="w-full h-full"
    />
  </div>
);
```

### Solução 2: Remover "Powered by Daily"

#### Opção A: Habilitar `hide_daily_branding` (Requer conta paga)

No arquivo `supabase/functions/video-room/index.ts`, descomentar e ativar:

```typescript
properties: {
  // ... outras propriedades
  hide_daily_branding: true, // Remover branding
},
```

**⚠️ Requisito**: A conta Daily.co deve estar no plano Pay-as-you-go (com cartão de crédito cadastrado). Caso contrário, a API retornará erro ou ignorará esta propriedade.

#### Opção B: Construir UI Customizada (Alternativa sem custo)

Se não for possível usar o plano pago, a alternativa é construir uma interface de vídeo completamente customizada usando o Daily.co "Call Object" ao invés do "Prebuilt". Isso envolve:

1. Renderizar os vídeos manualmente (`<video>` tags)
2. Controlar câmera/microfone via API
3. Construir toda a UI de controles

**Complexidade**: Alta - requer reimplementar toda a interface de vídeo

### Solução 3: Tradução

Já foi implementada a propriedade `lang: 'pt'` nas configurações. Se ainda estiver em inglês, pode ser porque a conta Daily.co tem configuração padrão em inglês. Podemos reforçar no nível da sala:

```typescript
// video-room/index.ts
properties: {
  lang: 'pt', // ou 'pt-BR'
  // ...
},
```

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/video/components/VideoCallEmbed.tsx` | Aumentar altura mínima do container de vídeo |
| `src/pages/video/JoinCallPage.tsx` | Usar `h-screen w-screen` para ocupar toda a tela |
| `supabase/functions/video-room/index.ts` | Habilitar `hide_daily_branding: true` (requer conta paga) |

## Sobre Remover Completamente o Branding

Para remover totalmente qualquer identificação do Daily.co:

1. **Branding na interface**: Use `hide_daily_branding: true` (conta paga)
2. **URL**: Já está resolvido com a rota `/call/:roomName`
3. **UI Prebuilt**: Se precisar 100% customizado, será necessário reconstruir usando Call Object (complexidade alta)

## Próximos Passos Recomendados

1. Primeiro, aplicar as correções de tamanho
2. Tentar habilitar `hide_daily_branding: true` e verificar se funciona com sua conta
3. Se não funcionar, verificar no painel do Daily.co se a conta está no plano correto
4. Se precisar de remoção total de branding sem custo, discutir a opção de UI customizada
