
Diagnóstico rápido (com evidência)
- O ramal está sendo criado na Api4Com da conta configurada para o agente (`atendejulia.api4com.com`).
- Validação direta via backend:
  - `get_account` retornou domínio `atendejulia.api4com.com`
  - `list_extensions` retornou os ramais `1000, 1001, 1002, 1003`
  - O `1003` existe com `id 201262` (usuário Cristiane / member 161).
- O que está confundindo: no banco/UI há dois números:
  - `extension_number` (local, ex: 1004)
  - `api4com_ramal` (real da Api4Com, ex: 1003)

Causa raiz provável
1) Divergência entre “ramal local” e “ramal real Api4Com” (parece erro, mas é mapeamento interno).  
2) O fluxo atual cria apenas em `/extensions`; não cria explicitamente o usuário organizacional em `/users` (como você exigiu no processo).

Plano de correção
1. Ajustar `create_extension` no `api4com-proxy` para fluxo oficial em 2 etapas
- Etapa A: `POST /users` (name, email, password, role).
- Etapa B: `POST /extensions` (ramal, senha, first_name, last_name, email_address, gravar_audio).
- Se o usuário já existir por email: tratar conflito e reutilizar/associar corretamente.

2. Verificação forte pós-criação antes de salvar no banco
- Após `POST /extensions`, confirmar com `GET /extensions` (por `id`/`ramal`).
- Só persistir no banco se confirmação passar.
- Se falhar persistência, rollback no provedor (deletar extensão e usuário criado nesta transação).

3. Eliminar ambiguidade de numeração no banco/UI
- Parar de gerar `localNumber` separado para criação.
- Usar `extension_number = api4com_ramal` por padrão (ou renomear claramente para “interno” se precisar manter).
- Atualizar labels da UI para deixar explícito qual número é da Api4Com.

4. Persistir vínculo completo da Api4Com
- Salvar também `api4com_user_id` e payload do usuário criado.
- Manter `api4com_raw` com retorno completo de criação de usuário + ramal.

5. Melhorar diagnóstico na tela
- No painel de diagnóstico SIP/ramal, exibir:
  - conta/domínio Api4Com ativo,
  - `api4com_id`,
  - `api4com_ramal`,
  - status da última verificação remota.
- Isso evita dúvida de “criou localmente mas não no provedor”.

Validação final (E2E)
- Criar novo ramal para um membro sem ramal.
- Confirmar em 3 pontos:
  1) Api4Com `/users` contém usuário,
  2) Api4Com `/extensions` contém ramal,
  3) banco local contém IDs e metadados corretos sem divergência.
- Reabrir tela de ramais e conferir que número exibido bate 1:1 com Api4Com.
