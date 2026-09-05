# Atualizar credenciais do banco de dados externo

## Objetivo
Trocar as credenciais de conexão do Postgres externo (usado pela Edge Function `db-query`) para o novo conjunto informado.

## Contexto
A Edge Function `db-query` lê as credenciais de variáveis de ambiente/secrets:

- `EXTERNAL_DB_URL` (opcional; se preenchida, tem precedência)
- `EXTERNAL_DB_HOST`
- `EXTERNAL_DB_PORT` (padrão 25061)
- `EXTERNAL_DB_DATABASE`
- `EXTERNAL_DB_USERNAME`
- `EXTERNAL_DB_PASSWORD`
- `EXTERNAL_DB_CA_CERT` (obrigatória para conexões SSL/TLS não-Unix)

## Passos

1. **Coletar novas credenciais**
   - Host/URL, porta, nome do banco, usuário, senha e certificado CA (se houver SSL).
   - Confirmar se a conexão usa URL completa ou campos separados.

2. **Atualizar secrets do projeto**
   - Usar `secrets--update_secret` para cada secret acima com os novos valores.
   - Se a conexão for por URL, ainda assim manter `EXTERNAL_DB_HOST`, `EXTERNAL_DB_PORT`, `EXTERNAL_DB_DATABASE`, `EXTERNAL_DB_USERNAME` e `EXTERNAL_DB_PASSWORD` preenchidos para fallback e diagnóstico.

3. **Redeploy da Edge Function `db-query`**
   - Publicar a função novamente para que o runtime carregue os secrets atualizados.

4. **Teste de conectividade**
   - Invocar `db-query` com uma query simples (ex.: `SELECT 1` ou `SELECT current_user, current_database()`) para confirmar que a conexão funciona.

## Resultado esperado
A aplicação passa a se conectar ao novo banco externo sem interrupção nas rotas que dependem de `externalDb`.

## Observação de segurança
Os valores atuais dos secrets não são legíveis (criptografados). Informe as novas credenciais quando aprovar o plano.
