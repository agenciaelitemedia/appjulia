# Nova aba "Telefonia" na right-bar do chat

Adicionar uma quarta aba na barra lateral direita do chat (ao lado de Contato / CRM / Lead) com o histórico de ligações do contato aberto.

## Conteúdo da aba

- Texto introdutório: "Veja todo o histórico de ligações feitas para este contato." com espaçamento abaixo.
- Duas sub-abas: **Voip Call** e **ZAP Call**.
- Cada item da lista mostra, em duas linhas:
  - Linha 1: data/hora da ligação (BRT) + quem fez (nome do atendente).
  - Linha 2: status da ligação + duração em minutos + botão de play da gravação.
- Estados vazios ("Nenhuma ligação registrada para este contato"), loading e badge de direção (entrada/saída).

## Origem dos dados

- **Voip Call**: tabela `phone_call_logs`, filtrando pelo `client_id` do usuário e pelo telefone do contato (comparando `caller`/`called` com as variações de número já usadas no projeto — 12/13 dígitos). Gravação via `record_url` (player de áudio simples, igual ao usado em Telefonia).
- **ZAP Call**: tabela `wavoip_call_logs`, filtrando por `client_id` e telefone (`from_number`/`to_number`/`whatsapp_jid`). Gravação reaproveitando o componente `RecordingPlayer` já existente (status/signed URL).
- Nome de quem ligou: `useTeamByClient` para mapear `app_user_id` (ZAP Call) e, no Voip, o ramal/atendente vinculado (`extension_number` / `cod_agent`), com fallback para o próprio número.

## Detalhes técnicos

- Novo hook `useContactCallHistory.ts` (dois queries React Query, um por fonte), com `enabled` só quando há telefone.
- Novo componente `ChatContactCallsPanel.tsx` em `src/modules/julia-chat/chat/components/`, com sub-abas via `Tabs` do shadcn.
- Alterar `src/modules/julia-chat/chat/components/ChatRightBar.tsx` (e o gêmeo `src/components/chat/ChatRightBar.tsx`, para manter paridade): incluir `{ id: 'phone', label: 'Telefonia', icon: Phone }` na lista de abas e renderizar o novo painel. Tipagem da aba no `WhatsAppDataContext` estendida para aceitar `'phone'`.
- Sem mudanças de banco; apenas leitura das tabelas existentes.
