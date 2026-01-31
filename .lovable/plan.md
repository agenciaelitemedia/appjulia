

# Fase 2: Seletor de Dispositivos e Background Blur

## Visao Geral

Este plano implementa a Fase 2 do sistema de videoconferencia, adicionando:

1. **Seletor de Dispositivos** - Permite escolher camera, microfone e alto-falante
2. **Background Blur** - Desfoque de fundo durante a chamada
3. **Modal de Configuracoes Centralizado** - Agrupa todas as opcoes em um unico lugar

---

## Arquitetura da Solucao

```text
VideoControls.tsx
     |
     +-- [Settings] Button --> VideoSettingsModal.tsx
                                    |
                                    +-- useDevices() (Daily React hook)
                                    +-- useVideoSettings() (expandido)
                                    |
                                    +-- Device Selectors (Camera/Mic/Speaker)
                                    +-- Background Blur Toggle + Slider
                                    +-- Noise Cancellation Toggle
```

---

## Componentes a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `src/pages/video/components/VideoSettingsModal.tsx` | Criar | Modal centralizado de configuracoes |
| `src/pages/video/hooks/useVideoSettings.ts` | Modificar | Adicionar background blur e integracao com useDevices |
| `src/pages/video/components/VideoControls.tsx` | Modificar | Adicionar botao de configuracoes e remover toggle de ruido inline |

---

## 1. Expandir o Hook useVideoSettings

O hook existente sera expandido para incluir:

- Gerenciamento de **background blur** com intensidade configuravel
- Referencia ao hook `useDevices()` do Daily React para listagem de dispositivos
- Funcoes para alterar dispositivos selecionados

**Estado adicional:**
```typescript
interface VideoSettings {
  noiseCancellation: boolean;
  networkQuality: NetworkQuality;
  backgroundBlur: boolean;
  backgroundBlurStrength: number; // 0.0 a 1.0
}
```

**Novas funcoes:**
```typescript
// Background blur
toggleBackgroundBlur: () => Promise<void>
setBackgroundBlurStrength: (strength: number) => Promise<void>

// Retorno do useDevices
devices: {
  cameras: DeviceObject[];
  microphones: DeviceObject[];
  speakers: DeviceObject[];
  currentCam: DeviceObject | undefined;
  currentMic: DeviceObject | undefined;
  currentSpeaker: DeviceObject | undefined;
  setCamera: (deviceId: string) => void;
  setMicrophone: (deviceId: string) => void;
  setSpeaker: (deviceId: string) => void;
}
```

---

## 2. Criar Modal de Configuracoes (VideoSettingsModal.tsx)

Modal com tres secoes:

```text
+------------------------------------------+
|           Configuracoes de Video         |
+------------------------------------------+
|                                          |
|  DISPOSITIVOS                            |
|  +------------------------------------+  |
|  | Camera: [v] Webcam HD (C920)       |  |
|  +------------------------------------+  |
|  | Microfone: [v] Mic Interno         |  |
|  +------------------------------------+  |
|  | Alto-falante: [v] Speakers (HD)    |  |
|  +------------------------------------+  |
|                                          |
|  AUDIO                                   |
|  [x] Cancelamento de ruido               |
|                                          |
|  VIDEO                                   |
|  [x] Desfocar fundo                      |
|      Intensidade: [====o=====] 50%       |
|                                          |
|  +------------------------------------+  |
|  |           [  Fechar  ]             |  |
|  +------------------------------------+  |
+------------------------------------------+
```

**Componentes utilizados:**
- `Dialog` do Radix UI (ja existe no projeto)
- `Select` para dropdowns de dispositivos
- `Switch` para toggles (ruido, blur)
- `Slider` para intensidade do blur

---

## 3. Atualizar VideoControls.tsx

**Mudancas:**
- Adicionar botao de configuracoes (icone `Settings`)
- Manter botoes de mic, camera e encerrar
- Remover o botao inline de cancelamento de ruido (movido para modal)

**Nova estrutura:**
```text
[Mic] [Camera] [Settings] [Encerrar]
```

---

## 4. APIs do Daily.co Utilizadas

### useDevices()
```typescript
import { useDevices } from '@daily-co/daily-react';

const {
  cameras,           // Lista de cameras
  microphones,       // Lista de microfones
  speakers,          // Lista de alto-falantes
  currentCam,        // Camera atual
  currentMic,        // Microfone atual
  currentSpeaker,    // Alto-falante atual
  setCamera,         // Trocar camera
  setMicrophone,     // Trocar microfone
  setSpeaker,        // Trocar alto-falante
} = useDevices();
```

### useInputSettings()
```typescript
import { useInputSettings } from '@daily-co/daily-react';

const { updateInputSettings } = useInputSettings();

// Background blur
updateInputSettings({
  video: {
    processor: {
      type: 'background-blur',
      config: { strength: 0.5 },
    },
  },
});

// Noise cancellation
updateInputSettings({
  audio: {
    processor: {
      type: 'noise-cancellation',
    },
  },
});

// Desativar processadores
updateInputSettings({
  video: { processor: { type: 'none' } },
  audio: { processor: { type: 'none' } },
});
```

---

## 5. Compatibilidade

| Funcionalidade | Browsers Suportados |
|----------------|---------------------|
| Background Blur | Chrome, Edge, Firefox (desktop apenas) |
| Noise Cancellation | Chrome, Edge, Firefox, Safari 17.4+ |
| Device Selection | Todos os browsers modernos |

**Nota:** Em dispositivos moveis ou browsers nao suportados, os toggles de blur serao desabilitados automaticamente.

---

## Detalhes Tecnicos

### Estrutura do VideoSettingsModal

```typescript
interface VideoSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoSettingsModal({ open, onOpenChange }: VideoSettingsModalProps) {
  const {
    cameras,
    microphones, 
    speakers,
    currentCam,
    currentMic,
    currentSpeaker,
    setCamera,
    setMicrophone,
    setSpeaker,
  } = useDevices();
  
  const {
    noiseCancellation,
    backgroundBlur,
    backgroundBlurStrength,
    toggleNoiseCancellation,
    toggleBackgroundBlur,
    setBackgroundBlurStrength,
  } = useVideoSettings();

  // ... renderizacao do modal
}
```

### Atualizacao do useVideoSettings

```typescript
export function useVideoSettings() {
  const { updateInputSettings } = useInputSettings();
  
  const [settings, setSettings] = useState<VideoSettings>({
    noiseCancellation: false,
    networkQuality: 'unknown',
    backgroundBlur: false,
    backgroundBlurStrength: 0.5,
  });

  const toggleBackgroundBlur = useCallback(async () => {
    const newValue = !settings.backgroundBlur;
    
    if (newValue) {
      await updateInputSettings({
        video: {
          processor: {
            type: 'background-blur',
            config: { strength: settings.backgroundBlurStrength },
          },
        },
      });
    } else {
      await updateInputSettings({
        video: { processor: { type: 'none' } },
      });
    }
    
    setSettings(prev => ({ ...prev, backgroundBlur: newValue }));
  }, [updateInputSettings, settings.backgroundBlur, settings.backgroundBlurStrength]);

  const setBackgroundBlurStrength = useCallback(async (strength: number) => {
    setSettings(prev => ({ ...prev, backgroundBlurStrength: strength }));
    
    if (settings.backgroundBlur) {
      await updateInputSettings({
        video: {
          processor: {
            type: 'background-blur',
            config: { strength },
          },
        },
      });
    }
  }, [updateInputSettings, settings.backgroundBlur]);

  // ... resto do hook
}
```

---

## Fluxo do Usuario

1. Usuario entra na chamada
2. Clica no botao de engrenagem (Settings)
3. Modal abre com configuracoes atuais
4. Usuario pode:
   - Trocar camera/microfone/alto-falante
   - Ativar/desativar cancelamento de ruido
   - Ativar/desativar blur de fundo
   - Ajustar intensidade do blur
5. Mudancas sao aplicadas em tempo real
6. Usuario fecha o modal

---

## Arquivos Finais

| Arquivo | Linhas Estimadas |
|---------|------------------|
| `src/pages/video/components/VideoSettingsModal.tsx` | ~200 |
| `src/pages/video/hooks/useVideoSettings.ts` | ~120 (atualizado) |
| `src/pages/video/components/VideoControls.tsx` | ~100 (atualizado) |

