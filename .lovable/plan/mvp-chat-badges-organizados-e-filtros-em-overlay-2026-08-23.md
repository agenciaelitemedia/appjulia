# MVP Chat — badges organizados e filtros em overlay

Trabalho apenas visual/estrutural no módulo `/mvp-chat`. Nenhuma query, hook ou regra de negócio muda.

## 1. Card da conversa — badges em 3 linhas

Linha 1 (largura fixa por badge, truncando o texto, com tooltip detalhado):
- Fila: ícone WhatsApp + nome da fila, em azul.
- Responsável: ícone de usuário + nome, em ciano; "Sem responsável" quando vazio.
- Júlia: ícone de robô
  - cinza + "Sem IA" quando a fila não tem agente vinculado;
  - verde + etapa da Júlia quando a sessão está ativa;
  - vermelho + etapa da Júlia quando a sessão está inativa.
- Removido: o badge de status (Aguardando/Atendimento/Resolvida/Fechada), já representado pelas abas.

Linha 2 (todos com largura fixa; o de CRM é o mais largo; tooltip em todos):
- SLA, no mesmo formato arredondado dos outros badges.
- CRM: ícone + "Sem CRM" em cinza, ou "Nome do CRM - Etapa" em azulado.
- Campanha: ícone + "---" em cinza quando não há campanha, ou o nome da campanha em magenta.

Linha 3:
- Etiquetas atribuídas, cada uma limitada a ~metade da largura do card (truncada), garantindo pelo menos 2 por linha.

Mantidos como estão: avatar, nome, horário relativo, prévia da mensagem, contador de não lidas, ícone de prioridade (clicável) e o duplo-check. Os badges de "+N conversas" e de ticket continuam disponíveis, posicionados junto da linha 2 sem quebrar as larguras fixas.

Tooltips detalhados: nome completo da fila e canal; responsável completo; estado da IA + etapa da Júlia; tipo/prazo de SLA; board + etapa do CRM; nome completo da campanha.

## 2. Cabeçalho da lista

- Remover a faixa de badges de totais (Total, Contatos, Aguard., Atend., Resolv., Fech., Não lidas, SLA!, Risco) que fica abaixo do bloco de filtros. Os contadores das abas continuam.

## 3. Bloco de filtros em overlay

- Ao expandir "Mais filtros", o painel passa a abrir sobreposto à lista (posicionamento absoluto sobre a coluna, com fundo sólido e sombra), sem empurrar a listagem.
- O painel dimensiona-se ao conteúdo, sem rolagem interna própria (limite de segurança apenas se exceder a altura da coluna).
- O cabeçalho fixo da lista deixa de ter altura elástica (`max-h-[60%]` + scroll), evitando que a lista encolha ao abrir filtros.

## Detalhes técnicos

- `src/modules/mvp-chat/components/MvpChatRow.tsx`: reestruturar o bloco de badges em três linhas; criar um subcomponente local `FixedBadge` (largura fixa via `w-[Npx]`, `truncate`, ícone `shrink-0`, envolto em Tooltip). Dados já presentes em `MvpChatRowData`: `queue_name`, `channel_type`, `assigned_to`, `queue_cod_agent` (define "Sem IA"), `session_is_active`, `julia_stage_name/color`, `crm_board_name/crm_pipeline_name`, `campaign`, `tags`.
- Cores por tokens/utilitários já usados no projeto (sky/cyan/emerald/red/magenta-pink/muted), sem cores hardcoded fora do padrão atual do arquivo.
- `src/modules/mvp-chat/pages/MvpChatPage.tsx`: remover o bloco `{c && (...)}` dos totais; tornar o container do cabeçalho `relative` e sem `max-h/overflow` elástico. `counters` continua sendo usado pelas abas.
- `src/modules/mvp-chat/components/MvpChatFilters.tsx`: trocar o `CollapsibleContent` inline por um painel `absolute left-0 right-0 top-full z-50` com `bg-popover border shadow-lg`, removendo `max-h-[38vh] overflow-y-auto` (mantendo apenas `max-h` de segurança grande). Também remover o rodapé com "N conversas encontradas" se ficar redundante — mantido, pois não é o bloco de totais pedido.
- Sem mudanças em hooks, SQL (`mvp_chat_list_feed`), tipos ou edge functions.
