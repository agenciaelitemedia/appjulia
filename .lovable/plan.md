

# Plano de Implementação: Videoconferência 1x1 com Daily.co

## Visão Geral

Implementar um sistema de videoconferência integrado ao CRM que permita:
- **Lead**: Acessar a chamada via link enviado pelo WhatsApp (sem download, direto no navegador)
- **Operador**: Gerenciar fila de leads aguardando e atender chamadas 1x1 dentro do sistema

## Pré-requisitos

### 1. Criar Conta no Daily.co
- Acessar [daily.co](https://www.daily.co/) e criar uma conta
- Obter a **API Key** do painel de desenvolvedor
- O plano gratuito permite até 100 participantes/mês e salas de até 60 minutos

### 2. Configurar Secret no Projeto
- Adicionar a secret `DAILY_API_KEY` nas configurações do projeto

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                              FLUXO GERAL                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   OPERADOR (CRM)                    DAILY.CO                  LEAD       │
│   ┌──────────────┐                ┌──────────┐          ┌──────────────┐│
│   │ Clica ícone  │───────────────>│ Cria     │          │              ││
│   │ videochamada │                │ sala     │          │              ││
│   │ no lead card │                │ única    │          │              ││
│   └──────────────┘                └────┬─────┘          │              ││
│          │                             │                │              ││
│          │                             │ URL da sala    │              ││
│          v                             v                │              ││
│   ┌──────────────┐          ┌──────────────────┐        │              ││
│   │ Envia link   │─────────>│ WhatsApp (UaZapi)│───────>│ Recebe link  ││
│   │ via WhatsApp │          └──────────────────┘        │ no WhatsApp  ││
│   └──────────────┘                                      └──────┬───────┘│
│          │                                                     │        │
│          v                                                     v        │
│   ┌──────────────┐                                      ┌──────────────┐│
│   │ Lead aparece │<─────────────── Sala ───────────────>│ Clica e      ││
│   │ na fila de   │              Daily.co                │ entra na     ││
│   │ espera       │                                      │ chamada      ││
│   └──────┬───────┘                                      └──────────────┘│
│          │                                                              │
│          v                                                              │
│   ┌──────────────┐                                                      │
│   │ Operador     │                                                      │
│   │ atende       │                                                      │
│   │ (embed)      │                                                      │
│   └──────────────┘                                                      │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Etapas de Implementação

### Fase 1: Backend (Edge Function)

#### Criar Edge Function `video-room`

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/video-room/index.ts` | Gerencia criação e listagem de salas |

**Endpoints:**

| Método | Ação | Descrição |
|--------|------|-----------|
| POST | `create` | Cria uma nova sala no Daily.co |
| GET | `list` | Lista salas ativas (leads aguardando) |
| POST | `close` | Encerra uma sala específica |

**Lógica de criação de sala:**
- Gera nome único baseado em timestamp + cod_agent
- Define expiração de 60 minutos (configurável)
- Salva metadados no banco (lead_id, cod_agent, room_name, status)
- Retorna URL da sala para envio via WhatsApp

**Tabela no banco externo (via db-query):**

```sql
CREATE TABLE video_rooms (
  id SERIAL PRIMARY KEY,
  room_name VARCHAR(255) UNIQUE NOT NULL,
  room_url TEXT NOT NULL,
  lead_id INTEGER REFERENCES crm_atendimento_cards(id),
  cod_agent VARCHAR(50) NOT NULL,
  whatsapp_number VARCHAR(20) NOT NULL,
  contact_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, in_call, ended
  created_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  operator_joined_at TIMESTAMP
);
```

---

### Fase 2: Frontend - Card do Lead

#### Modificar `CRMLeadCard.tsx`

| Alteração | Descrição |
|-----------|-----------|
| Novo ícone | Adicionar ícone de vídeo (Video) ao lado dos botões existentes |
| Handler | `handleVideoCall` - chama API para criar sala |
| Dialog | Confirma envio do link via WhatsApp |

**Novo botão no card:**
```tsx
<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-100/50"
  onClick={handleVideoCall}
>
  <Video className="h-4 w-4" />
</Button>
```

#### Criar `VideoCallDialog.tsx`

Dialog de confirmação que:
1. Mostra preview da mensagem que será enviada
2. Permite personalizar texto (opcional)
3. Envia link via WhatsApp usando integração existente (UaZapi)
4. Mostra feedback de sucesso/erro

---

### Fase 3: Frontend - Página de Fila de Atendimento

#### Criar nova rota `/video/queue`

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/video/VideoQueuePage.tsx` | Página principal da fila |
| `src/pages/video/components/VideoQueueCard.tsx` | Card de lead aguardando |
| `src/pages/video/components/VideoCallEmbed.tsx` | Embed do Daily.co |
| `src/pages/video/hooks/useVideoQueue.ts` | Hook para gerenciar fila |

**Layout da página:**

```text
┌─────────────────────────────────────────────────────────────────┐
│  🎥 Fila de Videochamadas                      [🔄 Atualizar]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐│
│  │   LEADS AGUARDANDO (3)  │  │     VIDEOCHAMADA ATIVA          ││
│  │                         │  │                                  ││
│  │  ┌───────────────────┐  │  │  ┌───────────────────────────┐  ││
│  │  │ 📞 5511999999999  │  │  │  │                           │  ││
│  │  │ Há 2 minutos      │  │  │  │    [Daily.co Embed]       │  ││
│  │  │ [Atender]         │  │  │  │                           │  ││
│  │  └───────────────────┘  │  │  │                           │  ││
│  │                         │  │  │                           │  ││
│  │  ┌───────────────────┐  │  │  │                           │  ││
│  │  │ 📞 5521988888888  │  │  │  │                           │  ││
│  │  │ Há 5 minutos      │  │  │  └───────────────────────────┘  ││
│  │  │ [Atender]         │  │  │                                  ││
│  │  └───────────────────┘  │  │  Lead: João Silva                ││
│  │                         │  │  Duração: 05:23                  ││
│  │  ┌───────────────────┐  │  │  [Encerrar Chamada]              ││
│  │  │ 📞 5531977777777  │  │  │                                  ││
│  │  │ Há 8 minutos      │  │  └─────────────────────────────────┘│
│  │  │ [Atender]         │  │                                     │
│  │  └───────────────────┘  │                                     │
│  │                         │                                     │
│  └─────────────────────────┘                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Funcionalidades:**
- Lista de leads aguardando com tempo de espera
- Embed do Daily.co para a chamada ativa
- Botão para encerrar chamada
- Atualização em tempo real (polling ou realtime)
- Indicador visual de status (aguardando, em chamada)

---

### Fase 4: Integração Daily.co

#### Instalar SDK React do Daily.co

```bash
npm install @daily-co/daily-js @daily-co/daily-react
```

#### Componente de Embed

```tsx
// VideoCallEmbed.tsx
import DailyIframe from '@daily-co/daily-js';
import { useEffect, useRef } from 'react';

function VideoCallEmbed({ roomUrl, onLeave }) {
  const callRef = useRef(null);
  
  useEffect(() => {
    if (!roomUrl) return;
    
    const callFrame = DailyIframe.createFrame(callRef.current, {
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: '8px',
      },
      showLeaveButton: true,
    });
    
    callFrame.join({ url: roomUrl });
    callFrame.on('left-meeting', onLeave);
    
    return () => callFrame.destroy();
  }, [roomUrl]);
  
  return <div ref={callRef} className="w-full h-full min-h-[400px]" />;
}
```

---

### Fase 5: Menu e Navegação

#### Atualizar Sidebar

Adicionar novo item no menu:

| Grupo | Item | Rota | Ícone |
|-------|------|------|-------|
| CRM | Videochamadas | `/video/queue` | Video |

#### Atualizar App.tsx

Adicionar nova rota:

```tsx
<Route path="/video/queue" element={<VideoQueuePage />} />
```

---

## Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `supabase/functions/video-room/index.ts` | Edge function para gerenciar salas |
| `src/pages/video/VideoQueuePage.tsx` | Página principal da fila |
| `src/pages/video/components/VideoQueueCard.tsx` | Card de lead na fila |
| `src/pages/video/components/VideoCallEmbed.tsx` | Embed do Daily.co |
| `src/pages/video/components/VideoCallDialog.tsx` | Dialog de confirmação |
| `src/pages/video/hooks/useVideoQueue.ts` | Hook de dados da fila |
| `src/pages/video/types.ts` | Tipos TypeScript |

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/components/CRMLeadCard.tsx` | Adicionar botão de videochamada |
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Adicionar botão de videochamada |
| `src/components/layout/Sidebar.tsx` | Adicionar item de menu |
| `src/App.tsx` | Adicionar rota |
| `supabase/functions/db-query/index.ts` | Adicionar actions para video_rooms |
| `src/lib/externalDb.ts` | Adicionar métodos para video_rooms |

---

## Fluxo Detalhado

### 1. Operador Inicia Videochamada

```text
1. Operador clica no ícone de vídeo no card do lead
2. Dialog de confirmação aparece com preview da mensagem
3. Operador confirma envio
4. Sistema:
   a. Chama Edge Function para criar sala no Daily.co
   b. Salva sala no banco com status 'waiting'
   c. Envia link via WhatsApp (UaZapi)
5. Lead recebe link no WhatsApp
6. Card atualiza com indicador de "videochamada pendente"
```

### 2. Lead Entra na Sala

```text
1. Lead clica no link recebido
2. Abre no navegador (sem download)
3. Entra automaticamente na sala
4. Sistema detecta presença (webhook Daily.co ou polling)
5. Lead aparece na fila de espera do operador
```

### 3. Operador Atende

```text
1. Operador acessa /video/queue
2. Vê lista de leads aguardando
3. Clica em "Atender" em um lead
4. Daily.co embed carrega com a sala
5. Operador entra na chamada 1x1
6. Status da sala muda para 'in_call'
```

### 4. Encerramento

```text
1. Operador ou lead encerra a chamada
2. Sistema atualiza status para 'ended'
3. Sala é removida da fila
4. Opcionalmente: registra duração no histórico
```

---

## Considerações Técnicas

### Segurança
- Salas com expiração automática (60 min)
- URLs únicas e não previsíveis
- Validação de cod_agent para acesso à fila

### Performance
- Polling a cada 10 segundos para atualizar fila
- Lazy loading do SDK Daily.co
- Cache de salas ativas

### UX
- Feedback visual claro de status
- Toast de confirmação ao enviar link
- Indicador de tempo de espera
- Notificação sonora (opcional) quando lead entra

---

## Custos Estimados (Daily.co)

| Plano | Minutos/mês | Custo |
|-------|-------------|-------|
| Free | 100 participantes | $0 |
| Scale | Pay-as-you-go | $0.01/min |
| Enterprise | Customizado | Contato |

---

## Próximos Passos após Aprovação

1. Criar conta no Daily.co e obter API Key
2. Configurar secret `DAILY_API_KEY` no projeto
3. Implementar Edge Function `video-room`
4. Criar tabela `video_rooms` no banco externo
5. Implementar componentes frontend
6. Testar fluxo completo end-to-end

