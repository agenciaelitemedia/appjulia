## Diagnóstico

A falha atual não é erro do payload nem da API Wavoip ainda. A chamada do frontend está indo para:

`wavoip-device-provision`

Mas o backend respondeu `404 Requested function was not found`, e não existem logs dessa função. Isso indica que a função criada no código ainda não está disponível no backend publicado. Também há uma função antiga com nome parecido (`wavoip-provision-device`) já configurada, o que aumenta o risco de desalinhamento de nomes.

## Plano de correção

1. **Padronizar o nome da função usada no fluxo novo**
   - Manter `wavoip-device-provision` como função oficial do novo cadastro automático, pois é o nome que contém a lógica correta de `/v2/sales/buy-device`.
   - Garantir que ela esteja registrada/publicada no backend.

2. **Implantar e validar a função correta**
   - Publicar `wavoip-device-provision` no backend.
   - Testar uma chamada direta com payload mínimo para confirmar que a resposta deixa de ser `404` e passa a retornar erro controlado de validação quando faltar campo obrigatório.

3. **Adicionar proteção contra chamadas presas/erro genérico no frontend**
   - Melhorar o tratamento de erro em `useActivateWavoipForUser` para mostrar a causa real quando a função retornar erro JSON.
   - Se ainda houver erro de rede/função inexistente, exibir mensagem específica: “Função de provisionamento Wavoip indisponível”, em vez de apenas “Failed to send a request to the Edge Function”.

4. **Revisar função antiga duplicada**
   - Confirmar que `wavoip-provision-device` não é mais usada no fluxo novo.
   - Não excluir agora para evitar quebrar integrações antigas, mas deixar o fluxo de clientes usando somente `wavoip-device-provision`.

5. **Validação final**
   - Testar criação de dispositivo com o mesmo payload visto na falha:
     - `provider_id`
     - `plan_id`
     - `client_id`
     - `user_plan_id`
     - `device_name: Comercial`
     - `channels: 1`
   - Confirmar que o erro de função não encontrada desapareceu.
   - Se a API Wavoip retornar erro real depois disso, capturar e exibir o detalhe para ajustar o payload/API sem mascarar como falha de Edge Function.