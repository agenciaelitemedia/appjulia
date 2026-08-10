# Contrato voltando link interno em vez do ZapSign

## O que os dados mostram

Sessão da Maria (Auxílio-acidente, escritório 405):

- 05:49 a 05:51 — seis contratos criados com `provider = zapsign`, todos com `status = error`, sem link, e com a mesma mensagem gravada: `{"error": "token zapsign ausente"}`.
- 05:52 — um contrato com `provider = internal`, que gerou justamente o link `https://acesso.atendejulia.com.br/x-julia/contrato/3de184b8-...` (esse link é o assinador interno do módulo, não o ZapSign).

A configuração está correta no banco:

- Agente "Especialista — Auxílio-acidente (INSS)" com provedor de contrato ZapSign.
- Token do ZapSign salvo em Provedores (chave padrão do tipo "contrato", 72 caracteres).
- Modelo `.docx` do caso ativo, com as 9 variáveis mapeadas (`{{Nome}}`, `{{CPF}}`, `{{RG}}`, `{{Endereço Completo}}`, `{{Bairro}}`, `{{Cidade}}`, `{{Estado}}`, `{{CEP}}`, `{{DATA}}` → data automática).

Ou seja: os dados existem, mas a execução não usou nem o modelo nem o token.

## Causa

A mensagem "token zapsign ausente" só é produzida pelo caminho **antigo** de envio ao ZapSign, que procura o token na tabela legada `ai_provider_keys` (vazia). O caminho novo — que usa o modelo `.docx` do caso e busca o token em agente → escritório → padrão global — existe no código compartilhado, mas o motor de atendimento em produção ainda roda um pacote publicado antes dessas mudanças. Por isso ele nunca tenta o modelo, cai no caminho legado, não encontra token e o contrato fica em erro; depois, ao gerar de novo com provedor interno, saiu o link `acesso.atendejulia.com.br`.

## Correções

1. **Republicar as funções que geram contrato** com o código atual: `x-julia-engine`, `x-julia-followup-runner` e `x-julia-admin`. Só isso já faz o fluxo usar o modelo do ZapSign e o token dos Provedores.
2. **Fallback legado corrigido**: o envio "sem modelo" passa a resolver o token pela mesma cadeia (agente → escritório → padrão global), então nunca mais aparece "token ausente" com token configurado.
3. **Não silenciar falha do ZapSign**: quando o provedor do caso/agente é ZapSign e a geração falha, a skill devolve o motivo real (modelo do caso não configurado, erro da API etc.) em vez de anunciar contrato pronto. O link interno passa a valer só quando o provedor escolhido for de fato "interno".
4. **Diagnóstico**: registrar nos eventos da sessão qual provedor/modelo foi usado e, em caso de erro, o status/resposta do ZapSign, visível nos detalhes da sessão.
5. **Reteste** na sessão da Maria: gerar o contrato novamente e confirmar link do domínio `zapsign.com.br` com as 9 variáveis preenchidas (inclusive a data "Brasília/DF, 10 de agosto de 2026").

## Detalhes técnicos

- `supabase/functions/_shared/x-julia/contracts.ts`: `sendViaZapSign` passa a usar `resolveZapsignToken`; erro do ZapSign propagado; nenhum `sign_url` interno quando o provedor é ZapSign.
- `supabase/functions/_shared/x-julia/skills.ts`: `gerar_contrato` retorna mensagem explícita quando o contrato fica em `error`.
- Deploy: `x-julia-engine`, `x-julia-followup-runner`, `x-julia-admin`.
- Opcional: marcar os 6 contratos em erro dessa sessão como cancelados para não poluir o histórico.