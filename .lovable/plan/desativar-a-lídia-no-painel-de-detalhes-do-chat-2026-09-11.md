# Desativar a LÍDIA no painel de detalhes do chat

## O que muda

- A aba "LÍDIA" deixa de aparecer no painel lateral direito do chat, para todos os usuários (inclusive a conta do piloto).
- Quem tinha a LÍDIA como última aba aberta passa a cair automaticamente em "Contato", sem tela em branco.
- Nenhum arquivo da LÍDIA é apagado: o código fica parado, pronto para religar depois.
- Fica registrado em memória que a decisão é temporária e precisa ser revisada (manter ou remover de vez).

## Detalhes técnicos

1. `src/modules/lidia/access.ts`: adicionar flag `LIDIA_ENABLED = false`; `isLidiaAllowed` retorna `false` enquanto a flag estiver desligada (allowlist preservada para religar).
2. `src/modules/julia-chat/chat/components/ChatRightBar.tsx`: a aba `lidia` já é condicionada por `isLidiaAllowed`, então desaparece sozinha; ajustar o ramo de render para, quando `rightBarTab === 'lidia'` e a LÍDIA estiver desligada, exibir o conteúdo de "Contato" em vez da mensagem de indisponibilidade.
3. `src/modules/julia-chat/chat/contexts/WhatsAppDataContext.tsx`: na leitura do valor salvo (linha ~436), descartar `'lidia'` e voltar para `'contact'`; `setRightBarTab` também normaliza `'lidia'` para `'contact'`.
4. A Edge Function `lidia-copilot` permanece publicada, mas sem chamadas a partir da interface.

## Memória

Criar `mem://features/lidia/status-desativado` (tipo constraint) e referenciá-la no índice: LÍDIA desativada em 2026-09-11 por decisão do usuário; arquivos em `src/modules/lidia/` e a função `lidia-copilot` mantidos; revisar depois se mantém ou remove; não reativar a aba sem pedido explícito.

## Verificação

`bunx tsgo --noEmit` e build; abrir `/chat` e confirmar que o painel direito mostra apenas Contato, CRM, Lead e Telefone.
