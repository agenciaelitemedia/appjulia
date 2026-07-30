# API de Leitura dos Dados da Julia (para BI / scripts externos)

## Por que não dá acesso direto ao banco

- O backend do projeto é gerenciado (Lovable Cloud): não há URL de projeto, senha de banco nem service role key para acesso externo.
- Os dados da Julia (contratos, sessões, CRM de leads, agentes) não estão nesse banco — estão no **Postgres externo legado**, cujas credenciais ficam apenas nos secrets do backend e são usadas somente pela função interna `db-query`.
- Portanto, o caminho correto para BI/script é uma **API de leitura própria**, com chave, que consulta esse banco por trás.

## O que será construído

Uma nova função de backend `julia-report-api`: endpoint HTTP público, autenticado por chave de API, **somente leitura**, com consultas pré-definidas (sem SQL vindo de fora).

```text
BI / script  --(x-api-key)-->  julia-report-api  --(credenciais internas)-->  Postgres Julia
```

### Endpoints

| Método / rota | O que retorna |
|---|---|
| `GET /agents` | agentes do client (cod_agent, nome, business_name, perfil) |
| `GET /sessoes?from&to&cod_agent` | sessões de atendimento (view `vw_painelv2_desempenho_julia`) |
| `GET /contratos?from&to&cod_agent&status` | contratos (view `vw_painelv2_desempenho_julia_contratos`) |
| `GET /leads?from&to&stage` | cards do CRM da Julia + estágio |
| `GET /resumo?from&to` | totais agregados por agente (sessões, contratos, assinados, taxa) |

Todos aceitam `format=json` (padrão) ou `format=csv` — CSV para conectar direto em Power BI / Google Sheets / Excel.
Paginação por `limit` (máx. 5000) e `offset`.

### Segurança

- Chave de API gerada e guardada como secret; enviada no header `x-api-key`. Requisição sem chave válida → 401.
- A chave é vinculada a um `client_id`: **todas** as queries filtram por esse client, então um BI externo nunca lê dados de outro escritório.
- Nada de SQL livre: apenas as consultas parametrizadas acima (sem reuso da action `raw`).
- Somente `SELECT`. Nenhuma rota de escrita.
- Datas obrigatórias em `from`/`to` nas rotas de volume, com janela máxima (ex.: 180 dias) para não derrubar o banco legado.

### Como você vai usar

```bash
curl -H "x-api-key: SUA_CHAVE" \
  "<url-da-função>/julia-report-api/contratos?from=2026-07-01&to=2026-07-31&format=csv"
```

No Power BI / Sheets: usar a URL com `format=csv` como fonte web, com a chave na querystring desabilitada por padrão (só header) — se você precisar de fonte que não permite header, incluo suporte opcional a `?key=`.

## Detalhes técnicos

- Nova função `supabase/functions/julia-report-api/index.ts`, com CORS, `verify_jwt = false` (autenticação própria por chave) e roteamento por sufixo de path.
- Reaproveita o padrão de conexão do `db-query` (postgresjs, detecção de socket Unix, normalização do CA SSL) via `_shared`.
- Secrets novos: `JULIA_REPORT_API_KEY` (gerada) e `JULIA_REPORT_CLIENT_ID` (o client que a chave pode ler). Se precisar de mais de um cliente/chave, faço um mapa de chaves em tabela.
- Serialização CSV feita na própria função (sem dependência extra).

## Perguntas que definem detalhes finais

- Se você quiser mais de uma chave (uma por escritório/consumidor), eu troco os secrets por uma tabela de chaves com hash — diga se é necessário.
