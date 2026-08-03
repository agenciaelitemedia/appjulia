# Ressincronizar mensagens do lead pela UaZapi (corrigir datas)

## Diagnóstico confirmado

Contato **Tassia — 5519982045075** (client 294, fila Comercial), 1 conversa aberta, **23 mensagens** no chat — exatamente as 23 que a UaZapi retorna. Ou seja, **nenhuma mensagem está faltando: 8 delas estão com a data 3 horas atrasada**.


| Mensagem                           | Data real (UaZapi) | Data gravada no chat | Diferença |
| ---------------------------------- | ------------------ | -------------------- | --------- |
| áudio `3EB01E88…`                  | 13:11:17           | 10:11:14             | −3h       |
| "*Dr. Juarez:* , vou te explicar…" | 13:11:26           | 10:11:24             | −3h       |
| áudio `3EB09352…`                  | 13:27:26           | 10:27:24             | −3h       |
| áudio `3EB0A9B6…`                  | 13:31:24           | 10:31:20             | −3h       |
| áudio `3EB0E28D…`                  | 13:32:10           | 10:32:06             | −3h       |
| áudio `3EB09BD2…`                  | 13:38:27           | 10:38:24             | −3h       |
| áudio `3EB0DCA4…`                  | 13:39:23           | 10:39:20             | −3h       |
| "*Dr. Juarez:* NOME COMPLETO…"     | 13:51:55           | 10:51:54             | −3h       |


Todas as 8 são de saída, com `sender_name = "Dr. Juarez"` e sem `metadata` — ou seja, foram gravadas por um sistema externo (fluxo n8n / agente Júlia) que grava a hora de Brasília **sem o fuso**, e o banco interpreta como UTC. As mensagens gravadas pelo webhook da UaZapi estão com data correta.

Efeito visível: essas 8 aparecem todas amontoadas no início da conversa, fora da ordem real do diálogo.

## O que será feito

### 1. Função de ressincronização (`chat-resync-timestamps`)

Nova função de backend que recebe `{ queue_id, phone | contact_id, limit }` e:

- busca o histórico real na UaZapi (`POST /message/find` do chat);
- casa cada mensagem pelo `message_id`;
- quando a data real difere da gravada em mais de 60 segundos, corrige `timestamp` e `created_at`;
- **não** cria, apaga nem reescreve texto/mídia — só datas;
- devolve um relatório do que foi corrigido (e roda em modo `dry_run` primeiro, para você conferir antes de aplicar).

### 2. Correção dos agregados da conversa

Depois de ajustar as datas, recalcula na conversa e no contato:

- `last_message_at` do contato;
- `last_customer_message_at`, `last_message_from_me` e `updated_at` da conversa,
sempre a partir da mensagem real mais recente — assim a ordem na lista de conversas e os prazos de SLA voltam a bater.

### 3. Botão "Ressincronizar datas" no painel da conversa

Nos detalhes da conversa (painel lateral do chat), uma ação para admin/owner que dispara a ressincronização daquele contato, mostra quantas mensagens foram corrigidas e recarrega a conversa.

### 4. Aplicar agora nesse lead

Executo a ressincronização para o 5519982045075 e te mostro o antes/depois das 8 mensagens.

## Causa raiz (fora do app)

O fluxo externo que grava as respostas do "Dr. Juarez" envia a hora local sem `-03:00`. Enquanto isso não for ajustado no n8n, mensagens novas vão continuar nascendo 3h atrasadas — a ressincronização corrige depois, mas o ideal é o fluxo passar a enviar a data em UTC (ou com o fuso explícito). Se você quiser, na mesma leva eu adiciono uma proteção no lado do banco: um gatilho que, ao inserir uma mensagem sem fuso vinda desse caminho, ajusta a data para o horário do servidor.

## Detalhes técnicos

- Nova função em `supabase/functions/chat-resync-timestamps/index.ts`, reutilizando as credenciais da fila (`evo_url`, `evo_apikey`) já guardadas em `queues` e o padrão `{action, data}` das outras funções.
- Correção via `UPDATE` por `id` em `chat_messages` (lote), tolerância de 60s para não mexer em diferenças normais de rede.
- Frontend: ação no `ChatSidePanel` (oculta em modo somente leitura), com `invalidateQueries` das mensagens e da lista de conversas.