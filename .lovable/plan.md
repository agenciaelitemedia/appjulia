## Diagnóstico
A causa raiz está confirmada:
- As tabelas `user_device_log` e `user_performance_log` existem, mas estão com `0` linhas.
- O app faz login por `externalDb.login` (auth própria), então o client `supabase` no navegador continua sem sessão autenticada do backend.
- As gravações de telemetria estão saindo como `anon` e sendo barradas pelas regras atuais.
- Evidência atual: `POST /user_performance_log` retorna `new row violates row-level security policy`.
- Isso explica por que `user_activity_log` funciona e a telemetria não: `user_activity_log` está aberto para `public`, enquanto as tabelas novas exigem usuário autenticado do backend.

## Plano de correção
1. **Mover a escrita da telemetria para o backend interno**
   - Adicionar ações no `db-query` para gravar `user_device_log` e `user_performance_log`.
   - As gravações passarão pelo backend já usado no projeto, sem depender de sessão do `supabase-js` no browser.

2. **Mover a leitura da tela de monitoramento para o mesmo backend**
   - Adaptar `useDeviceTelemetry.ts` para buscar `user_device_latest` e `user_performance_log` via `db-query`.
   - Isso evita leituras vazias por falta de sessão/autorização no client atual.

3. **Atualizar os pontos de envio no frontend**
   - Trocar `logUserDevice` e `logPagePerformance` para usar o novo caminho seguro.
   - Manter comportamento silencioso para o usuário final, mas com logs técnicos úteis para depuração.

4. **Validar ponta a ponta**
   - Fazer login e navegar em rotas para gerar telemetria.
   - Confirmar que surgem linhas nas tabelas e que `/admin/monitoramento` passa a exibir Ambiente & Performance.

## Detalhes técnicos
- Não vou abrir essas tabelas para `anon`, porque isso enfraqueceria a segurança.
- A correção preserva o modelo atual do projeto: autenticação própria + backend interno para operações protegidas.
- Se necessário, também ajusto os acessos de leitura para manter a visualização restrita ao fluxo administrativo já existente.

## Resultado esperado
- Login gera snapshot de ambiente.
- Navegação gera métricas de performance.
- A aba **Ambiente & Performance** começa a mostrar dados reais sem depender de sessão nativa do backend.