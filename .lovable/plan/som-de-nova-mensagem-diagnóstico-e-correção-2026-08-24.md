# Som de nova mensagem — diagnóstico e correção

## O que verifiquei

- O alerta sonoro é global (`useNewMessageSound`, montado no `MainLayout`), com canal Realtime próprio em `chat_messages`.
- O arquivo `public/som/nova-mensagem.mp3` existe.
- `chat_messages`, `chat_conversations` e `chat_client_settings` estão na publicação Realtime e com policies de SELECT liberadas — a entrega do evento não é o problema.

## Causa confirmada

O gate de "para quem tocar" está errado. Ao receber a mensagem, o hook consulta a conversa e só toca se:

- `status = 'pending'`, **ou**
- `assigned_to` for igual ao `user.id` do usuário logado.

Mas na base `chat_conversations.assigned_to` guarda o **nome** do atendente (ex.: "Dra. Kátia", "Marcela Jayme"), nunca o id numérico. Logo a comparação `String(assigned_to) === String(user.id)` é sempre falsa.

Resultado prático: só toca som para conversas em "Aguardando" (`pending`). Assim que a conversa passa para "Em atendimento" (`open`), inclusive quando é do próprio usuário, o som deixa de tocar — que é exatamente o sintoma relatado.

Fatores secundários a checar junto (não são a causa principal):
- Usuários silenciados: várias contas têm ids em `sound_alert_muted_users` — se o usuário que reclamou estiver nessa lista, não toca de propósito.
- Autoplay: o som só destrava após o primeiro clique/tecla na aba; se a aba foi aberta e nunca tocada, o primeiro alerta é engolido pelo navegador.

## Correção proposta

Em `src/hooks/useNewMessageSound.ts`:

1. Comparar o responsável por **nome e id**, normalizando (trim + case-insensitive), do mesmo jeito que o resto do chat identifica responsável — resolve o caso "conversa em atendimento minha".
2. Manter o som para `status = 'pending'` (fila de espera) e adicionar tolerância: se a consulta da conversa falhar, tocar (hoje o erro silencia o alerta).
3. Aumentar a robustez do destrave de autoplay: reaproveitar o destrave em `visibilitychange` além de `pointerdown`/`keydown`, e não marcar como destravado quando o `play()` falhar.

Sem mudança de banco e sem mexer no resto do chat.

## Detalhes técnicos

- Único arquivo alterado: `src/hooks/useNewMessageSound.ts`.
- O match de responsável usará `user.name` (fonte real do valor gravado em `assigned_to`) com fallback para `user.id`, evitando quebrar bases que eventualmente gravaram id.
- Nenhuma alteração em RLS, publicação Realtime ou nas configurações de `chat_client_settings`.
