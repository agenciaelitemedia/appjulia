Reorganizar os botões do cabeçalho do chat (`ChatHeader.tsx`) em três linhas distintas, conforme solicitado:

1. **Primeira linha**: botões de ação principais — `Assumir`, `CRM`, `VOIP Call`, `ZAP Call`.
2. **Segunda linha**: bloco com botões de descrição/ações secundárias — Detalhes, Adiar, Transferir, Devolver, Resolver, Encerrar, Reabrir e menu "Mais".
3. **Terceira linha**: bloco da Julia (`CrmActionBar`) — status, contrato, CRM, status do agente e switch.

### Alterações propostas

No arquivo `src/components/chat/ChatHeader.tsx`:

- Manter a linha superior com avatar, nome, badges de status/fila/SLA/prioridade e tags.
- Mover todos os botões de ação para uma nova área logo abaixo dos dados do contato, organizada em três linhas flexíveis.
- Agrupar os quatro botões principais (`Assumir`, `ChatCrmButton`, `VOIP Call`, `WavoipCallButton`) em uma linha com `flex flex-wrap gap-2`.
- Colocar o bloco de botões secundários (atual `inline-flex items-center gap-0.5 border rounded px-1 py-0.5`) na segunda linha, mantendo seus comportamentos e ícones.
- Mover o `<CrmActionBar />` da posição atual (`px-3 pb-2 flex justify-end`) para a terceira linha, alinhado à esquerda ou conforme o layout atual, preservando suas props.
- Garantir espaçamento consistente entre as linhas (ex.: `gap-2` no container vertical) e manter a responsividade em telas menores (wrap automático).
- Preservar todos os estados, handlers, permissões, tooltips, diálogos e condições existentes (`canTakeOver`, `isActive`, `phoneReady`, etc.).

### Escopo
- Apenas alteração de layout/presentação no componente `ChatHeader`.
- Nenhuma mudança em lógica de negócio, hooks, permissões ou chamadas de API.
- Nenhuma alteração nos subcomponentes (`ChatCrmButton`, `WavoipCallButton`, `CrmActionBar`) ou diálogos.