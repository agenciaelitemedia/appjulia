# Vincular chat ao CRM sem agente da Júlia

## Situação atual (verificada)

- Ao criar o card pelo chat (`CreateCrmCardSheet`), há um bloqueio explícito: sem `cod_agent` resolvido aparece "Nenhum agente disponível na sua conta" e o card não é salvo.
- O `cod_agent` é resolvido em cascata: conversa → fila → primeiro agente do usuário. Escritórios sem agente da Júlia não têm nenhuma dessas fontes.
- No banco, `crm_deals.cod_agent` (e boards, fases, notas, auditoria) é `NOT NULL`, mas aceita string vazia — e já existe base assim: vários quadros de clientes (incluindo o 405) estão gravados com `cod_agent` vazio e funcionam normalmente.
- Nenhuma consulta do CRM Builder filtra por `cod_agent`: quadros, fases, cards e vínculos filtram por `client_id`. O `cod_agent` serve de metadado e para os recursos da Júlia (card da Júlia no banco externo, contrato, alias, status de sessão).
- `chat_crm_links.cod_agent` já é nulável.

## Impacto de criar o vínculo sem cod_agent

Nenhum impacto nas funções principais do CRM:

- Quadros, fases, cards, movimentação, permissões, histórico e automações continuam funcionando (tudo por `client_id`).
- O que deixa de existir são apenas os recursos exclusivos da Júlia dentro do card: busca do card da Júlia por WhatsApp + agente, status do contrato e badge de agente/alias. Esses blocos já têm caminho de "sem Júlia" (`isJulia = false`) e simplesmente não aparecem.

Ou seja: `cod_agent` não é requisito funcional do vínculo — é enriquecimento quando existe agente.

## O que será feito

1. **Remover o bloqueio de criação** em `CreateCrmCardSheet`: sem agente resolvido, o card é criado normalmente.
2. **Herdar o agente do quadro escolhido** quando houver: `cod_agent` do board selecionado como primeira opção; depois conversa/fila/agente do usuário; se nada existir, grava string vazia (padrão já presente na base) para respeitar o NOT NULL.
3. **Ajustar o selo do topo**: em vez do aviso vermelho, mostrar selo neutro "Sem agente da Júlia (vínculo apenas por fila)".
4. **Bloco da Júlia condicional**: busca do card da Júlia e switch de vínculo só aparecem quando existir `cod_agent`; sem agente, a seção Vínculos mostra apenas "Conversa do chat".
5. **`chat_crm_links`**: gravar `cod_agent` como `null` quando não houver e deixar de exigir agente para registrar o vínculo ao card existente (hoje o relink só grava a linha se houver agente).

## Detalhes técnicos

- Arquivo principal: `src/components/chat/CreateCrmCardSheet.tsx` (cascata `effectiveCodAgent`, `handleCreate`, `handleLinkExisting`, cabeçalho e seção Vínculos).
- Sem migração de banco: `cod_agent` permanece `NOT NULL` em `crm_deals` e recebe `''`, como já ocorre hoje; `chat_crm_links.cod_agent` já aceita nulo.
- Sem mudança nos hooks de leitura (`useCRMDeals`, `useCRMBoards`, `useChatDealLink`) — nenhum filtra por `cod_agent`.
- `useDealJuliaContext` continua retornando `isJulia = false` sem agente, então o card do CRM Builder já se comporta corretamente.