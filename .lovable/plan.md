

# Adicionar Secret META_WEBHOOK_VERIFY_TOKEN

## O que fazer

Quando eu sair do modo de planejamento, vou usar a ferramenta `add_secret` para solicitar que você insira o valor do token.

## Como gerar seu token

Você pode gerar um token seguro de qualquer forma. Sugestão:

```text
julia_waba_verify_2026_<seu-codigo-aleatorio>
```

Ou use um gerador online de strings aleatórias (32+ caracteres).

## Passos

| # | Ação |
|---|---|
| 1 | Adicionar o secret `META_WEBHOOK_VERIFY_TOKEN` no projeto (você cola o valor) |
| 2 | Copiar o **mesmo valor** no Meta Developers Dashboard → WhatsApp → Configuration → Callback URL → Verify Token |
| 3 | O `meta-webhook` já usa essa env var — nenhuma alteração de código necessária |

## Nenhum arquivo será alterado

O código em `meta-webhook/index.ts` já lê `Deno.env.get('META_WEBHOOK_VERIFY_TOKEN')`. Basta adicionar o secret.

