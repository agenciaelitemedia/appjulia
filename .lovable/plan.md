## Diagnóstico

A telemetria **já está gravando** dados normalmente:
- `user_device_log`: 2 linhas
- `user_performance_log`: 7 linhas (rotas `/chat`, `/dashboard`, `/admin/monitoramento`, etc.)

Tudo do `user_id = 2` (usuário logado agora). Os demais usuários (ex.: Mario Castro) aparecem "sem dados" porque:

1. O snapshot de **ambiente** (`logUserDevice`) só é disparado **dentro de `login()`** no `AuthContext`. Quem já estava logado quando o recurso entrou no ar nunca passa por esse ponto.
2. **Performance** só é registrada quando o próprio usuário navega — não tem como o admin "ver" dados de um usuário que não está online.

Portanto não há bug de captura; falta apenas cobrir usuários com sessão persistida.

## Ajuste proposto

Adicionar um disparo **uma vez por sessão de navegador** (além do login) que envia o snapshot de ambiente assim que o app carrega com um usuário já autenticado.

### Onde

`src/contexts/AuthContext.tsx` — efeito que roda quando `user` deixa de ser nulo na hidratação inicial.

### Lógica

- `useEffect([user?.id])`: se `user` existe e `sessionStorage.getItem('telemetry_device_sent')` está vazio, chama `collectClientEnvironment() → logUserDevice(...)` e marca o flag.
- `sessionStorage` (não `localStorage`) garante: 1x por aba/sessão, e re-coleta quando abrirem o navegador novamente (capturando mudança de rede/dispositivo).
- Mantém o disparo atual dentro de `login()` (cobre login novo).
- Falha silenciosa, igual hoje.

### Resultado esperado

- Próxima vez que cada usuário ativo abrir o app, surge a linha em `user_device_log`.
- A aba **Ambiente** do `/admin/monitoramento` começa a popular para esses usuários sem precisar pedir logout.
- Performance continua dependendo do usuário navegar (comportamento correto — não dá pra coletar Web Vitals de quem não está usando).

## Fora do escopo

- Não mexer no edge function `telemetry` (já validado funcionando).
- Não mexer na UI da aba (`DeviceTelemetryTab`) nem nos hooks de leitura.
- Não criar nova migration.
