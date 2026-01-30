
# Plano de Melhorias: Sistema de Videoconferência com Daily.co

## Análise da Implementação Atual

O sistema de videoconferência já possui:
- Criação e gerenciamento de salas via Edge Function
- Gravação automática na nuvem com download posterior
- Compartilhamento de tela
- Controles básicos (microfone, câmera, encerrar)
- Histórico de chamadas com filtro por operador
- Interface white-label sem marcas do Daily.co
- Watchdog de conexão (20s timeout)
- Singleton global para evitar duplicação de instâncias

## Funcionalidades Disponíveis no Daily.co para Implementar

Baseado na documentação atual do Daily.co, as seguintes funcionalidades podem agregar valor:

| Funcionalidade | Impacto | Complexidade |
|----------------|---------|--------------|
| 1. Background Blur/Virtual Background | Alto | Média |
| 2. Cancelamento de Ruído | Alto | Baixa |
| 3. Seletor de Dispositivos (câmera/mic) | Alto | Média |
| 4. Indicador de Qualidade de Rede | Médio | Baixa |
| 5. Transcrição em Tempo Real | Alto | Alta |
| 6. Indicador de Speaker Ativo | Médio | Baixa |
| 7. Lobby/Sala de Espera (Pre-join) | Médio | Média |

---

## 1. Background Blur e Virtual Background

Permite aos usuários desfocar ou substituir o fundo durante a chamada.

**Implementação:**
- Usar `updateInputSettings()` do Daily.co
- Tipos disponíveis: `background-blur`, `background-image`, `none`
- Adicionar botão nos controles de vídeo

**Código necessário:**
```typescript
// Ativar blur
daily.updateInputSettings({
  video: {
    processor: {
      type: 'background-blur',
      config: { strength: 0.8 }
    }
  }
});

// Ativar fundo virtual
daily.updateInputSettings({
  video: {
    processor: {
      type: 'background-image',
      config: { source: 'https://example.com/bg.jpg' }
    }
  }
});
```

**Limitação:** Suportado apenas em browsers desktop (Chrome, Firefox, Edge).

---

## 2. Cancelamento de Ruído (Krisp)

Reduz ruído de fundo no microfone automaticamente.

**Implementação:**
- Usar `updateInputSettings()` com `noise-cancellation`
- Adicionar toggle nos controles de áudio

**Código necessário:**
```typescript
daily.updateInputSettings({
  audio: {
    processor: {
      type: 'noise-cancellation'
    }
  }
});
```

**Compatibilidade:** Chrome, Firefox, Edge, Safari 17.4+

---

## 3. Seletor de Dispositivos

Permitir que usuários escolham qual câmera e microfone usar durante a chamada.

**Implementação:**
- Usar hooks `useDevices()` ou `daily.enumerateDevices()`
- Criar dropdown com lista de dispositivos
- Usar `setInputDevicesAsync()` para trocar dispositivo

**Código necessário:**
```typescript
// Listar dispositivos
const devices = await daily.enumerateDevices();
const cameras = devices.devices.filter(d => d.kind === 'videoinput');
const mics = devices.devices.filter(d => d.kind === 'audioinput');

// Trocar dispositivo
await daily.setInputDevicesAsync({
  videoDeviceId: selectedCameraId,
  audioDeviceId: selectedMicId,
});
```

---

## 4. Indicador de Qualidade de Rede

Mostrar ao usuário se a conexão está boa, média ou ruim.

**Implementação:**
- Escutar evento `network-connection` e `network-quality-change`
- Exibir ícone com cores (verde/amarelo/vermelho)

**Código necessário:**
```typescript
useDailyEvent('network-quality-change', (event) => {
  // event.threshold: 'good' | 'low' | 'very-low'
  setNetworkQuality(event.threshold);
});
```

---

## 5. Transcrição em Tempo Real (Legendas)

Exibir legendas ao vivo durante a chamada.

**Implementação:**
- Requer integração com Deepgram (API key separada)
- Habilitar `enable_transcription` na criação da sala
- Usar hook `useTranscription()` para receber texto

**Código necessário (Edge Function):**
```typescript
// Na criação da sala
properties: {
  enable_transcription: 'deepgram:YOUR_DEEPGRAM_KEY'
}
```

```typescript
// No frontend
const { transcription } = useTranscription();
// transcription contém o texto em tempo real
```

**Observação:** Requer API key do Deepgram (custo adicional).

---

## 6. Indicador de Speaker Ativo

Destacar visualmente quem está falando na chamada.

**Implementação:**
- Usar hook `useActiveSpeakerId()`
- Adicionar borda animada no VideoTile do speaker ativo

**Código necessário:**
```typescript
const activeSpeakerId = useActiveSpeakerId();

// No VideoTile
<div className={cn(
  "relative rounded-lg",
  sessionId === activeSpeakerId && "ring-2 ring-primary animate-pulse"
)}>
```

---

## 7. Lobby/Pre-join UI

Tela de preparação antes de entrar na chamada (testar câmera/mic).

**Implementação:**
- Usar `startCamera()` sem `join()` para preview
- Mostrar preview do próprio vídeo
- Botão "Entrar na Reunião" executa `join()`

**Código necessário:**
```typescript
// Preview sem entrar
await daily.startCamera();

// Quando pronto
await daily.join({ url: roomUrl });
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/video/components/VideoControls.tsx` | Modificar | Adicionar botões de blur, noise, devices |
| `src/pages/video/components/VideoSettings.tsx` | Criar | Modal de configurações (devices, blur) |
| `src/pages/video/components/NetworkIndicator.tsx` | Criar | Indicador de qualidade de rede |
| `src/pages/video/components/VideoTile.tsx` | Modificar | Destacar speaker ativo |
| `src/pages/video/components/PreJoinLobby.tsx` | Criar | Tela de preview antes de entrar |
| `src/pages/video/hooks/useVideoSettings.ts` | Criar | Hook para gerenciar blur/noise/devices |

---

## Priorização Recomendada

**Fase 1 - Alto impacto, baixa complexidade:**
1. Cancelamento de Ruído
2. Indicador de Speaker Ativo
3. Indicador de Qualidade de Rede

**Fase 2 - Alto impacto, média complexidade:**
4. Seletor de Dispositivos
5. Background Blur

**Fase 3 - Funcionalidades avançadas:**
6. Lobby/Pre-join UI
7. Transcrição em Tempo Real (requer Deepgram)

---

## Detalhes Técnicos

### Estrutura do VideoSettings

```text
┌─────────────────────────────────┐
│         Configurações           │
├─────────────────────────────────┤
│ Câmera: [Dropdown]              │
│ Microfone: [Dropdown]           │
│ Alto-falante: [Dropdown]        │
├─────────────────────────────────┤
│ ☐ Cancelar ruído de fundo       │
│ ☐ Desfocar fundo                │
│   Intensidade: [═══●═══]        │
└─────────────────────────────────┘
```

### Controles Expandidos

```text
┌───────────────────────────────────────────────┐
│  [Mic] [Câmera] [Tela] [Config] [Sair]       │
│                                               │
│  ● Rede boa                                   │
└───────────────────────────────────────────────┘
```
