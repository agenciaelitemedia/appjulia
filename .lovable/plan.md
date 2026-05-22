## Objetivo
Fazer os checks das mensagens evoluírem corretamente de enviado para entregue e lido no chat.

## Diagnóstico atual
- O componente do chat já sabe exibir os checks corretamente:
  - `sent` = 1 check
  - `delivered` = 2 checks
  - `read` = 2 checks destacados
- O listener realtime também já atualiza mensagens alteradas no banco.
- O gargalo está no backend: os logs recentes mostram eventos chegando como `messages`, não como `messages.update`.
- Hoje o webhook só traduz mudança de status dentro do ramo `messages.update`.
- No banco, isso aparece claramente: a maioria das mensagens enviadas nas últimas 24h ficou em `sent`, e só uma parte pequena chegou em `read`.

## Plano
### 1. Tratar status também no fluxo `messages` / `messages.upsert`
Adicionar no webhook a leitura de status quando o provedor mandar o evento como `messages`, não apenas `messages.update`.

### 2. Normalizar os identificadores usados no match
Aplicar a mesma estratégia robusta de IDs nos dois fluxos:
- `id`
- `messageid`
- `key.id`
- id com prefixo do owner
- id sem prefixo

Assim o update de status consegue encontrar a linha certa em `chat_messages` mesmo quando o provedor muda o formato do identificador.

### 3. Evitar regressão de status
Impedir que uma mensagem volte de `read` para `delivered` ou `sent` se os eventos chegarem fora de ordem.

### 4. Melhorar observabilidade do webhook
Adicionar logs objetivos para cada tentativa de atualização de status:
- evento recebido
- IDs candidatos
- status bruto recebido
- status final mapeado
- quantidade de linhas afetadas

### 5. Validar ponta a ponta
Depois da implementação, validar este fluxo:
1. enviar mensagem
2. confirmar `sent`
3. aguardar `delivered`
4. abrir no aparelho destino e confirmar `read`
5. garantir que o bubble muda de 1 check para 2 checks e depois para 2 checks destacados

## Detalhes técnicos
```text
Frontend
- MessageBubble: já está correto
- realtime UPDATE de chat_messages: já está correto

Backend
- uazapi-chat-webhook:
  - hoje atualiza status só em messages.update
  - precisa também atualizar status em messages/messages.upsert
  - precisa normalizar IDs antes do update
  - precisa ignorar downgrade de status
```

## Resultado esperado
- As mensagens deixam de ficar presas em 1 check.
- O status passa a evoluir conforme os eventos reais do provedor.
- O chat fica resiliente mesmo quando o provedor envia atualização de status no evento `messages` em vez de `messages.update`.