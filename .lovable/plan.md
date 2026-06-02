## Problema

O lead Raylanne (5598985005211) aparece na lista de "Meus Atendimentos" com a fila **Escritório Dra. Flávia – Jurídico** (a conversa que está realmente aberta para a Raquel), mas ao clicar o painel principal abre a conversa **MKT Natal** (que foi `closed` automaticamente pelo trigger). O cabeçalho, mensagens e ações passam a operar sobre a conversa errada.

## Causa

Existem **duas fontes de verdade** desalinhadas para "qual conversa representa este contato":

1. **Lista** (`src/components/chat/ChatList.tsx`, linhas 1590-1592)  
   Usa `convsByContact[0]`, derivado de `sortedConversations` — que vem do `conversations` do contexto e, na aba ativa, contém apenas `pending/open`. Resultado: pega a Jurídico (aberta).

2. **Conversa selecionada** (`src/contexts/WhatsAppDataContext.tsx`, linhas 2280-2295)  
   Usa `leaderByContact` (de `useContactLatestConversation`), que considera **todas as conversas** (incluindo `closed`/`resolved`) e escolhe a de `updated_at` mais recente. Como o trigger `trg_auto_resolve_prior_queue_conversations` setou `updated_at = now()` na MKT Natal ao fechá-la, a Natal virou líder (12:53 > 12:22 da Jurídico).

Ou seja, sempre que uma conversa fechada/resolvida for mais recente que a aberta do mesmo contato, list e detalhe vão divergir.

## Correção

### 1. Tornar `selectedConversation` consistente com a lista

Em `src/contexts/WhatsAppDataContext.tsx`, alterar o memo `selectedConversation` para **priorizar uma conversa ativa** (`pending`/`open`) do contato quando existir, e só cair para o leader (mais recente independente de status) quando não houver nenhuma ativa.

Ordem de resolução nova:
1. Conversa `open` mais recente do contato (entre `conversations` carregadas).
2. Conversa `pending` mais recente do contato.
3. Leader atual (`leaderByContact`), preservando o comportamento para contatos sem nada ativo (aba Resolvidas/Fechadas continua funcionando).

Isso garante que clicar no card da lista abra exatamente a conversa cujo `queue_id` foi mostrado no item.

### 2. Garantir alinhamento também nas abas Resolvidas/Fechadas

Quando a aba ativa é Resolvidas ou Fechadas, a lista mostra a leader naquele grupo. Para manter o casamento, a resolução acima deve respeitar o filtro de status atual:

- Em abas `pending/open`: prioriza `open` → `pending` → leader.
- Em abas `resolved`/`closed`: usa o leader do grupo (já correto hoje via `leaderByContact` + filtro de contatos).

Adicionar leitura do `conversationStatusFilter` no memo `selectedConversation` para escolher a heurística certa.

### 3. Trigger de auto-resolução: não bagunçar o `updated_at`

O `updated_at` da conversa antiga sendo atualizado pelo trigger é o que provoca a inversão da liderança. Alterar `auto_resolve_prior_queue_conversations` para **não promover** `updated_at` ao fechar:

- Setar apenas `status = 'closed'`, `closed_at = now()`, `close_note`.
- Preservar `updated_at` anterior (ou setar para o `closed_at` original menor que o `updated_at` da nova conversa).

Assim a leader natural continua sendo a conversa nova/aberta, e o desalinhamento não reaparece em outros leads.

Migração: substituir a função `public.auto_resolve_prior_queue_conversations` removendo `updated_at = now()` do UPDATE (e do trigger geral, se aplicável).

### 4. Sanitizar o registro já corrompido do Raylanne

Restaurar o `updated_at` da conversa MKT Natal `1beef669...` para um valor anterior ao `updated_at` da Jurídico `537d73dc...` (ex.: `closed_at` original), para que ela pare de aparecer como leader hoje. Não altera status, nem histórico.

## Arquivos afetados

- `src/contexts/WhatsAppDataContext.tsx` — novo memo `selectedConversation` com prioridade por status + filtro ativo.
- `supabase/migrations/<novo>.sql` — `CREATE OR REPLACE FUNCTION public.auto_resolve_prior_queue_conversations` sem mexer em `updated_at`.
- Atualização pontual via SQL no registro `1beef669-...` (UPDATE de `updated_at`).

## Verificação

1. Recarregar `/chat`, abrir Meus Atendimentos.
2. Card do Raylanne deve mostrar fila **Dra. Flávia – Jurídico**; ao clicar, o cabeçalho/mensagens devem abrir a mesma conversa Jurídico.
3. Forçar novo cenário: enviar mensagem em uma nova fila para um contato com conversa ativa noutra fila — o trigger deve fechar a antiga sem inverter a leader, e o detalhe deve abrir a fila nova (a aberta).
4. Aba Resolvidas: continuar abrindo a conversa resolvida mais recente.
