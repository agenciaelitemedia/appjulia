# Som de alerta global para novas mensagens do Chat

## Objetivo
Tocar o som enviado (`bible_images-whatsapp-message-sound-effect-3-386095.mp3`) em **qualquer página da plataforma** sempre que chegar uma nova mensagem recebida no módulo /chat — sem interferir em nenhuma funcionalidade existente.

## Como funciona hoje
O chat só escuta novas mensagens em tempo real quando a página /chat está aberta (o contexto do chat é montado apenas lá). Por isso, o alerta sonoro será implementado de forma **independente**, num hook global montado no layout principal (`MainLayout`), que envolve todas as páginas autenticadas.

## O que será feito

### 1. Salvar o arquivo de som
- Criar a pasta `public/som/`
- Salvar o MP3 como `public/som/nova-mensagem.mp3` (nome simples e estável para referência no código)

### 2. Novo hook global `useNewMessageSound` (arquivo novo, sem tocar em código existente)
- Resolve o `client_id` efetivo do usuário (mesma lógica já usada: `user.client_id` ou herdado do dono do escritório)
- Abre uma assinatura Realtime **própria e separada** (canal exclusivo, ex.: `chat_messages_sound_alert`) escutando apenas INSERTs na tabela de mensagens filtrados pelo `client_id` — não compartilha nem interfere no canal usado pela página /chat
- Toca o som **apenas** quando:
  - a mensagem é **recebida** (`from_me = false`)
  - **não** é nota interna
  - não é duplicada (controle por ID já visto)
- **Throttle de ~2 segundos**: se chegarem várias mensagens em rajada, o som toca uma vez, evitando "metralhadora" de áudio

### 3. Tratamento de áudio do navegador (importante)
- Navegadores bloqueiam áudio antes da primeira interação do usuário. O hook:
  - Pré-carrega o áudio uma única vez
  - "Destrava" o áudio silenciosamente na primeira interação (clique/tecla)
  - Se o navegador bloquear o play, falha silenciosamente — nunca gera erro visível

### 4. Montagem no layout
- Uma linha no `MainLayout`: chamar `useNewMessageSound()` junto dos outros hooks globais (presença, heartbeat). Nada mais é alterado.

## Garantias de não-interferência
- Nenhum arquivo do chat (`WhatsAppDataContext`, `ChatContainer`, etc.) é modificado
- Canal Realtime separado com nome exclusivo — sem conflito com o canal do /chat
- Sem alteração de backend, banco ou RLS
- Se o áudio falhar (autoplay bloqueado, arquivo indisponível), o sistema segue funcionando normalmente

## Arquivos
| Arquivo | Ação |
|---|---|
| `public/som/nova-mensagem.mp3` | criar (upload do usuário) |
| `src/hooks/useNewMessageSound.ts` | criar |
| `src/components/layout/MainLayout.tsx` | adicionar 1 import + 1 chamada de hook |
