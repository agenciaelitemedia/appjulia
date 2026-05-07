## O que aconteceu na ligação que acabou de disparar

Pelos sinais do replay e do código, o mais provável é que **não foi uma discagem iniciada pelo frontend**. O que aconteceu foi:

1. O ramal estava **Disponível**.
2. Depois entrou em **Conectando...**.
3. Em seguida apareceu o erro **"Chamada cancelada ou não atendida"**.
4. No snapshot atual **não há requisição de `dial`** para os proxies de telefonia, então não há evidência de clique do usuário disparando uma chamada de saída.

## Causa mais provável

O sistema está tratando uma **chamada SIP entrante/callback do provedor** como se fosse uma tentativa de discagem do usuário que falhou.

### Evidências no código

- `useSipPhone.ts` escuta `newRTCSession` e processa **chamadas entrantes** automaticamente no hook SIP.
- `PhoneContext.tsx` transforma qualquer falha com causa `Canceled` em:
  - `"Chamada cancelada ou não atendida"`
  - abertura do erro no softphone
- `MainLayout.tsx` só mostra o `SoftphoneWidget` quando:
  - `showSoftphone`, ou
  - `isDialing`, ou
  - `dialError`

Isso cria um problema importante:

- se entrar uma chamada no ramal **sem clique do usuário**, a UI **não mostra o estado de toque/entrada**;
- quando essa chamada é cancelada, o sistema exibe um erro que parece ser de **ligação originada pelo usuário**.

Ou seja: o usuário percebe como “o sistema disparou ligação sozinho”, mas o comportamento real parece ser **uma chamada entrante invisível que foi cancelada**.

## Sobre o auto-answer

A proteção que foi adicionada antes reduziu bastante o risco de atendimento automático indevido:

- agora só autoatende dentro da janela de 60s após uma discagem recente.

Por isso, para **esse evento mais recente**, o cenário mais provável é:

- **entrou uma chamada/callback externa no ramal**;
- ela **não foi exibida corretamente na UI**;
- depois foi cancelada;
- o sistema mostrou isso como erro de discagem.

## Problema secundário encontrado

O warning abaixo é real, mas **não é a causa da ligação**:

`validateDOMNesting(...): <button> cannot appear as a descendant of <button>`

Origem:
- `ChatContactItem.tsx` usa o item inteiro como `<button>`
- `PriorityBadge.tsx` também usa `<button>` dentro dele

Isso pode causar comportamento estranho de clique/foco no chat, então deve ser corrigido, mas é um problema separado da telefonia.

## Plano de correção

### 1. Separar chamada entrante de discagem do usuário
Em `useSipPhone.ts` e `PhoneContext.tsx`:
- registrar a direção da sessão (`incoming` vs `outgoing`)
- só transformar falha em `dialError` quando a sessão for realmente de saída
- para chamada entrante cancelada/perdida, mostrar estado apropriado como:
  - `Chamada recebida cancelada`
  - ou toast discreto, sem parecer que o sistema discou sozinho

### 2. Exibir o softphone também para chamadas entrantes
Em `MainLayout.tsx`:
- fazer o `GlobalSoftphone` aparecer quando `sip.status` estiver em:
  - `ringing`
  - `calling`
  - `in-call`
- isso permite que o usuário veja imediatamente que houve uma chamada entrante e possa atender/recusar

### 3. Endurecer a lógica defensiva do SIP
Em `useSipPhone.ts`:
- manter a trava da janela de 60s
- ampliar os diagnósticos com eventos explícitos como:
  - `incoming call received`
  - `auto-answer blocked: no recent dial`
  - `incoming call canceled before answer`
- opcionalmente exigir correlação mais forte para autoanswer, não apenas header + janela temporal

### 4. Ajustar a mensagem de erro para não confundir o usuário
Em `PhoneContext.tsx`:
- diferenciar mensagens como:
  - saída falhou
  - callback do provedor cancelado
  - chamada entrante perdida/cancelada

### 5. Corrigir o warning de HTML inválido no chat
Em `ChatContactItem.tsx` e/ou `PriorityBadge.tsx`:
- remover a estrutura `button dentro de button`
- solução mais segura: trocar o container do item da conversa para `div` com `role="button"` + suporte a teclado

## Arquivos que precisam ser ajustados

- `src/pages/telefonia/hooks/useSipPhone.ts`
- `src/contexts/PhoneContext.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/chat/ChatContactItem.tsx`
- `src/components/chat/PriorityBadge.tsx`

## Resultado esperado depois da correção

- nenhuma chamada entrante será apresentada como se o usuário tivesse clicado em ligar
- o softphone aparecerá corretamente quando o ramal receber uma chamada
- eventos cancelados não abrirão erro enganoso de discagem
- o warning de `button` aninhado será eliminado
- ficará mais fácil identificar se a origem foi callback do provedor, fila, campanha ou chamada real do usuário