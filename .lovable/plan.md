# X-Julia no escritório 405 — por que não ativou

## O que foi verificado

- Escritório 405 tem 1 agente X-Julia ativo: **X-Julia 01** (`is_active = true`).
- Ele está vinculado à fila **Pessoal** (uazapi, ativa, não excluída, com URL + token salvos) — o vínculo está correto.
- A fila recebe mensagens normalmente: várias conversas criadas hoje (a mais recente às 10:54 UTC), todas em `pending`, nenhuma atribuída a humano.
- O webhook de ingestão (`uazapi-chat-webhook`) já monta e dispara o evento para o motor em toda mensagem do lead.
- Nenhuma sessão X-Julia foi criada para o 405 (`xj_sessions` = 0 registros).

## Causas encontradas (duas, ambas precisam ser corrigidas)

1. **O motor X-Julia não está publicado.** Uma chamada de teste em `x-julia-engine` retorna `404 NOT_FOUND` e a função não tem nenhum log. Ou seja: o webhook chama, a chamada falha em silêncio (o erro só vira um `console.warn`) e nada acontece. Esta é a causa principal.
2. **O agente está configurado como "Apenas Campanha".** Na aba Ativação o agente está com `only_campaign` ligado e a frase de início de campanha `"teste de campanha"`. Com isso, mesmo com o motor publicado, ele só responderia leads vindos de anúncio/CTA ou que enviassem exatamente essa frase — conversas normais seriam ignoradas.

Observação: o horário de atuação está **desligado** (`enabled: false`), então não é ele que bloqueia.

## Correção proposta

1. Publicar as funções do módulo: `x-julia-engine` (e junto `x-julia-followup-runner`, que também nunca foi publicada), depois confirmar com uma chamada de ping e conferir os logs.
2. Desligar "Apenas Campanha" no agente X-Julia 01 do escritório 405, para que ele atenda qualquer lead que chegar na fila Pessoal (mantendo a frase de campanha como gatilho extra, não como restrição). Se a intenção real for atender só campanha, deixamos ligado — nesse caso o comportamento atual está correto e só o item 1 resolve.
3. Enviar uma mensagem de teste para a fila Pessoal e validar nos logs do motor que a sessão X-Julia é criada e a resposta é enviada.

## Melhoria de diagnóstico (para não repetir)

- Fazer o webhook registrar em log o status HTTP da chamada ao `x-julia-engine` (hoje só captura exceção de rede), de forma que um 404/500 do motor apareça nos logs de ingestão.
- Na tela do agente X-Julia, exibir um aviso quando "Apenas Campanha" estiver ligado, explicando que leads fora de campanha não serão atendidos.
