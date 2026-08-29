# Conector MCP: só OAuth, sem chaves de acesso

## A URL do conector

A URL que se cola no OpenClaw / ChatGPT / Claude é a do endpoint MCP do backend:

```text
<URL do backend>/functions/v1/copiloto-mcp
```

Ela já é exibida (e copiável) no cartão "Conector oficial (MCP)" em `/mvp-copiloto`.
Ela **não pode** morar em `acesso.atendejulia.com.br`, porque o MCP responde a POST e a
hospedagem do app é estática. O que foi movido para o nosso domínio é apenas a
**descoberta OAuth** (`/.well-known/*` e `/authorize`), que era o ponto que quebrava o
OpenClaw.

## O que muda

1. **Remover o caminho por chave de acesso** — o cartão `AccessKeysCard` sai da página, o
   helper `createAccessKey` sai do `copilotoApi.ts` e a rota `access-key` sai da função
   `copiloto-oauth`. Chaves já emitidas continuam no banco, mas deixam de ser criadas pela
   interface (podem ser revogadas normalmente no cartão de conexões).
2. **Deixar a URL do MCP em destaque** — no cartão do conector, a URL ganha rótulo explícito
   ("URL do servidor MCP") e um aviso curto de que é essa (e só essa) que se cola no cliente.
3. **Passo a passo atualizado** na página `/mvp-copiloto`: colar a URL → o cliente descobre o
   OAuth pelo domínio da Julia → login e consentimento → ferramentas disponíveis. Sem
   qualquer menção a chave/Bearer manual.
4. **Documentação** (`docs/MCP_julia.md`): registrar OAuth como caminho único e remover a
   seção de chave de acesso.

O testador interno de ferramentas continua como está (token curto de 15 min gerado com a
própria senha, só dentro da Julia).

## Detalhes técnicos

- `src/modules/mvp-copiloto/pages/MvpCopilotoPage.tsx`: remover import e uso de `AccessKeysCard`; ajustar os passos.
- `src/modules/mvp-copiloto/components/AccessKeysCard.tsx`: excluir.
- `src/modules/mvp-copiloto/lib/copilotoApi.ts`: remover `createAccessKey`.
- `src/modules/mvp-copiloto/components/McpConnectionCard.tsx`: rótulo e texto de apoio da URL.
- `supabase/functions/copiloto-oauth/index.ts`: remover a rota `POST /access-key` (o restante — discovery, register, authorize, approve/deny, token, revoke, test-token — fica intacto) e reimplantar a função.
- Nenhuma migration; catálogo de tools somente leitura permanece igual.

## Validação

1. `/mvp-copiloto` sem o cartão de chaves e com a URL do MCP visível e copiável.
2. Adicionar o servidor no OpenClaw com essa URL: descoberta, consentimento e emissão de token concluídos.
3. `tools/list` responde com o catálogo; uma tool de leitura executada num lead real.
4. Revogar a conexão e confirmar 401 na chamada seguinte.
