## Diagnóstico
Verifiquei o caso do número `5534991633679` no banco.

- Existe uma conversa `resolved` para esse contato:
  - protocolo: `#2026-008604`
  - atribuída a: `Mario Castro`
- As mensagens mais recentes continuaram sendo gravadas nessa mesma conversa.
- Porém, elas foram persistidas como `from_me = true`.
- No webhook `uazapi-chat-webhook`, a regra de reabertura só executa quando a mensagem é tratada como recebida do cliente (`!fromMe`).
- Resultado: a mensagem entra na conversa antiga, mas a conversa não muda de `resolved` para `open`, e também não é criada uma nova conversa.

Em outras palavras: o problema não está na listagem; está na decisão do webhook sobre direção da mensagem e na aplicação da regra de reabertura.

## Plano
1. Ajustar a identificação de direção no `uazapi-chat-webhook`
   - Parar de depender apenas do campo bruto `fromMe`.
   - Consolidar a leitura de `chatid`, `sender_pn`, `owner`, `source` e o telefone normalizado para distinguir corretamente:
     - mensagem do cliente
     - mensagem do atendente/instância
   - Cobrir casos com número em formato antigo/novo (8º/9º dígito) e JIDs alternativos.

2. Reaplicar a regra de negócio após a direção correta
   - Se a última conversa do contato estiver `resolved` e a nova mensagem for do cliente:
     - reabrir a mesma conversa
     - manter `assigned_to`
     - manter o mesmo protocolo
     - voltar para `open`
   - Se a última conversa estiver `closed` e a nova mensagem for do cliente:
     - criar nova conversa
     - `assigned_to = null`
     - `status = pending`
     - gerar novo protocolo
   - Se já houver conversa `pending/open`, apenas anexar a mensagem nela.

3. Adicionar trilha de auditoria e logs mais explícitos
   - Registrar no histórico da conversa quando houver:
     - reabertura por nova mensagem
     - criação de nova conversa após `closed`
   - Melhorar logs do webhook com:
     - telefone resolvido
     - direção final da mensagem
     - status anterior
     - ação tomada
   Isso facilita identificar rapidamente novos casos parecidos.

4. Criar testes de regressão para o webhook UaZapi
   - Caso `resolved` + mensagem do cliente => reabre mantendo responsável.
   - Caso `closed` + mensagem do cliente => nova conversa sem responsável.
   - Caso mensagem do atendente => não disparar regra de reabertura por engano.
   - Caso com variação de número normalizado (`553491...` vs `5534991...`) => continuar encontrando o mesmo contato corretamente.

5. Validar o caso do número `5534991633679` após a correção
   - Reprocessar mentalmente/tecnicamente o fluxo com o payload real.
   - Se a mensagem realmente era do cliente, corrigir o estado da conversa afetada.
   - Se o payload realmente era do atendente, manter o estado atual e deixar a regra protegida para os próximos recebimentos reais.

## Arquivos previstos
- `supabase/functions/uazapi-chat-webhook/index.ts`
- possivelmente um helper compartilhado em `supabase/functions/_shared/*` para resolver direção/telefone
- novo teste para o webhook UaZapi

## Observação técnica
Hoje a evidência armazenada aponta que a última mensagem desse contato foi classificada como saída (`from_me = true`). Então a correção principal é tornar essa classificação robusta antes de aplicar a regra de reabertura. Depois disso, o comportamento esperado volta a ser consistente no chat.