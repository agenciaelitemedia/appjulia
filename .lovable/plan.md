## Objetivo
Quando um atendente humano envia uma mensagem manual e a Julia é desativada, disparar também a função `n8n_execute-followup-stop` para parar os follow-ups ativos e limpar o pré-followup daquele contato.

## Mudanças

### 1. `supabase/functions/_shared/disableJuliaOnHumanSend.ts`
Após desativar a sessão Julia com sucesso (passo 3 atual), adicionar uma chamada fire-and-forget para `n8n_execute-followup-stop`:

- Parâmetros:
  - `codAgent`: o mesmo `cod_agent` já resolvido via `queue_agent_links`
  - `sessionId`: o `contactPhone` (já normalizado pelo chamador)
- Invocação via `fetch` para `${SUPABASE_URL}/functions/v1/n8n_execute-followup-stop` usando service role (mesmo padrão do `callDbQuery`)
- Erros são apenas logados (best-effort), não bloqueiam o fluxo de envio
- Só dispara quando a desativação da sessão Julia realmente ocorreu (ou seja, dentro do mesmo bloco após `update_session_status`)

### 2. Comportamento preservado
- Mensagens de bot/campaign/autoreply/ai continuam sendo ignoradas (early-return já existente)
- Filas sem agente IA (`cod_agent` ausente) continuam no-op — não dispara followup-stop também, pois não há agente
- Sessão já inativa: mantém o comportamento atual (return antes de desativar). **Decisão a confirmar:** disparar followup-stop mesmo quando a sessão Julia já estava inativa? (caso o atendente continue conversando, pode haver followups antigos pendentes)

## Pergunta antes de implementar
Se a sessão Julia já estiver inativa (`session.active === false`), devo **mesmo assim** disparar o `followup-stop` para garantir que não sobrem follow-ups pendentes? Ou manter o early-return e só disparar quando há desativação efetiva?

## Arquivos
- editar: `supabase/functions/_shared/disableJuliaOnHumanSend.ts`

Nenhuma mudança em frontend, config.toml ou na função `n8n_execute-followup-stop` em si.
