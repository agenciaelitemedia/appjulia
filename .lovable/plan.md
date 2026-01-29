
# Plano de Correção: Videochamadas

## Problema Principal Identificado

Quando você clica em "Atender", o componente `VideoCallEmbed` tenta inicializar o iframe do Daily.co, mas ocorre um erro (`Cannot read properties of null (reading 'postMessage')`). O callback `onError` então chama `handleLeaveRoom()` que **deleta a sala permanentemente no Daily.co**.

Isso significa que a sala é destruída antes mesmo de conseguir conectar.

## Correções Necessárias

### 1. Separar "erro de conexão" de "encerrar chamada"

O `onError` não deve deletar a sala - apenas desconectar o operador da interface. A sala deve continuar existindo para que o lead possa esperar.

**Arquivo:** `src/pages/video/VideoQueuePage.tsx`

```tsx
// ANTES (problemático)
onError={(error) => {
  console.error('Video call error:', error);
  handleLeaveRoom(); // ❌ Isso DELETA a sala!
}}

// DEPOIS (correção)
onError={(error) => {
  console.error('Video call error:', error);
  setActiveRoom(null); // ✅ Apenas desconecta da UI, não deleta a sala
  toast.error('Erro ao conectar. Tente novamente.');
}}
```

### 2. Corrigir inicialização do iframe Daily.co

O erro `postMessage` geralmente ocorre quando o container DOM não está pronto. Vamos adicionar um pequeno delay e melhor verificação:

**Arquivo:** `src/pages/video/components/VideoCallEmbed.tsx`

```tsx
// Adicionar verificação mais robusta
useEffect(() => {
  if (!containerRef.current || !roomUrl) return;
  
  // Dar tempo para o DOM estar completamente pronto
  const timeoutId = setTimeout(() => {
    if (isInitializingRef.current || callFrameRef.current) return;
    initCall();
  }, 100);
  
  return () => clearTimeout(timeoutId);
}, [roomUrl]);
```

### 3. Adicionar tradução para português

**Arquivo:** `src/pages/video/components/VideoCallEmbed.tsx`

```tsx
const callFrame = DailyIframe.createFrame(containerRef.current!, {
  iframeStyle: { /* ... */ },
  showLeaveButton: false,
  showFullscreenButton: false,
  lang: 'pt', // ✅ Interface em português
});
```

### 4. Ocultar branding do Daily.co

Isso requer configuração na conta Daily.co (adicionar cartão de crédito) + usar a propriedade na criação da sala.

**Arquivo:** `supabase/functions/video-room/index.ts`

```typescript
// Na criação da sala
body: JSON.stringify({
  name: roomName,
  privacy: 'public',
  properties: {
    // ... outras configs
    hide_daily_branding: true, // Requer conta com cartão
  },
}),
```

### 5. Link do cliente em domínio próprio

Para o cliente acessar por um link do seu domínio, podemos criar uma página pública que embeda a chamada:

**Nova rota:** `/call/:roomName`

Esta página será simples, sem autenticação, apenas mostrando o vídeo do Daily.co embedado. O lead acessa esta URL ao invés da URL direta do Daily.co.

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/video/VideoQueuePage.tsx` | Separar erro de encerramento; não deletar sala em erro |
| `src/pages/video/components/VideoCallEmbed.tsx` | Delay na inicialização + lang: 'pt' |
| `supabase/functions/video-room/index.ts` | Adicionar hide_daily_branding |
| `src/pages/video/JoinCallPage.tsx` | **NOVA** - Página pública para leads |
| `src/App.tsx` | Adicionar rota /call/:roomName |
| `src/pages/video/components/VideoCallDialog.tsx` | Usar novo link do domínio próprio |

## Detalhes Técnicos

### Nova Página para Leads (`JoinCallPage.tsx`)

```tsx
// Página simples sem autenticação
export default function JoinCallPage() {
  const { roomName } = useParams();
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  
  useEffect(() => {
    // Buscar URL da sala no backend
    joinRoom(roomName).then(setRoomUrl);
  }, [roomName]);
  
  return (
    <div className="min-h-screen bg-gray-900">
      {roomUrl && (
        <DailyEmbed url={roomUrl} lang="pt" />
      )}
    </div>
  );
}
```

### Link enviado ao cliente

Em vez de enviar `https://your-team.daily.co/sala-xyz`, enviamos:
```
https://seudominio.com/call/julia-agent123-1234567890
```

Isso esconde completamente a origem do Daily.co.

## Sobre remover branding

Para remover o logo "Daily.co" da interface, você precisa:
1. Acessar sua conta no Daily.co
2. Adicionar um cartão de crédito (não cobra se não usar minutos além do free)
3. Habilitar `hide_daily_branding` via API

## Ordem de Implementação

1. **Correção crítica**: Não deletar sala em erro
2. **Delay na inicialização**: Resolver erro de postMessage
3. **Tradução**: Adicionar lang: 'pt'
4. **Página do lead**: Criar rota /call/:roomName
5. **Branding** (opcional): Configurar hide_daily_branding
