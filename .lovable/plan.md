# Corrigir "A fila selecionada não possui credenciais de conexão (URL/token)"

## Causa confirmada
No JulIA Chat, a lista de filas usada no painel "Iniciar nova conversa" vem de `useJuliaChatOptions`, cuja consulta traz apenas `id, name, channel_type` (verificado em `src/modules/julia-chat/hooks/useJuliaChatOptions.ts`, linha 21). O `NewConversationDialog` precisa de `evo_url`, `evo_apikey` e `evo_instance` para enviar a mensagem — como esses campos chegam vazios, o envio é bloqueado pela validação e aparece a mensagem de falha.

Confirmado no banco: as filas uazapi do escritório têm URL e token preenchidos, ou seja, o problema é só o dado que não é carregado na tela (não é configuração de fila). As únicas filas sem `evo_url/evo_apikey` são as de API Oficial (WABA), que já são filtradas do diálogo.

## Correção
1. `useJuliaChatOptions`: incluir `evo_url`, `evo_apikey`, `evo_instance` e `hub` no select das filas, e propagar esses campos no tipo retornado.
2. Manter o filtro atual (somente filas uazapi conectadas) no painel/rodapé de nova conversa.
3. Reforçar a mensagem de erro do diálogo para o caso raro de fila realmente sem credenciais, orientando abrir Filas e reconectar.

## Verificação
- Abrir /chat, expandir "Iniciar nova conversa", escolher uma fila uazapi conectada e enviar uma mensagem de teste: a conversa deve ser criada e aberta.
- Conferir que o diálogo continua não listando filas de API Oficial.
