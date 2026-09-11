# Painel de Memória por Contato

## Objetivo
Criar uma nova aba principal **Memória** no painel direito do chat. Ela reunirá, para o contato selecionado, o que o cliente relatou, o que os atendentes anotaram e os resumos já gerados, mesmo que o contato tenha passado por várias conversas.

## Onde ficará
A aba **Memória** ficará no topo do painel direito, ao lado de **Contato**, **CRM** e **Telefonia**, no chat principal JulIA e no chat legado ainda reutilizado.

A aba atual **Resumos** dentro de Contato será incorporada à Memória para evitar duas áreas com conteúdo semelhante. Tags, observações e informações da conversa permanecem onde estão.

## O que será exibido

### 1. Memória organizada
Um resumo vivo do contato, separado em blocos recolhíveis:
- **Perfil e contexto**: dados pessoais ou contexto que o próprio cliente informou.
- **Necessidades e caso**: motivo do contato, pedidos e situação relatada.
- **Dores e objeções**: preocupações, impedimentos e dúvidas.
- **Acordos e compromissos**: valores, condições, retornos ou ações combinadas.
- **Próximos passos**: pendências e encaminhamentos.
- **Observações da equipe**: informações registradas internamente pelos atendentes.

Cada item mostrará origem, autor quando houver, data e conversa de origem. A informação poderá ser aberta para consultar a mensagem, nota ou resumo que a sustenta. O sistema não apresentará deduções como fatos confirmados.

### 2. Linha do tempo das fontes
Uma visão cronológica, com filtros para:
- falas do cliente;
- notas internas dos atendentes;
- observações salvas nas conversas;
- resumos automáticos ou manuais.

A linha do tempo será paginada e cobrirá todas as conversas vinculadas ao mesmo `contact_id`, não apenas o atendimento aberto.

### 3. Manutenção da memória
- Botão **Atualizar memória** para processar novidades ainda não analisadas.
- Atualização incremental após novas falas do cliente e notas internas, sem bloquear o recebimento ou envio da mensagem.
- Inclusão manual de um item de memória por usuários autorizados.
- Edição para corrigir texto ou categoria.
- Arquivamento em vez de exclusão definitiva, mantendo histórico de auditoria.
- Aviso de “memória atualizada em…” e indicação de itens ainda aguardando processamento.

## Acesso definido

### Visualização
Todos os usuários ativos do mesmo escritório poderão visualizar a memória. O servidor derivará o `client_id` da sessão do usuário e recusará qualquer contato de outro escritório.

### Edição
Poderão adicionar, corrigir ou arquivar itens:
- o atendente responsável pela conversa ativa, comparado preferencialmente por `assigned_user_id`;
- gestores, seguindo o padrão atual de papéis privilegiados: `admin`, `user` e `colaborador`.

Usuários sem essa condição terão acesso somente para leitura. Conteúdo gerado automaticamente também poderá ser corrigido, mas a versão anterior ficará auditada.

## Reaproveitamento dos dados existentes
A primeira versão aproveitará as fontes já confirmadas no sistema:
- `chat_messages`: falas do cliente e notas internas (`internal_note = true`), com autor e data;
- `chat_conversations.observations`: observações gerais de cada conversa;
- `chat_conversation_summaries`: resumos, sentimento e avaliação já persistidos por contato;
- `chat_conversation_history`: eventos operacionais usados apenas como contexto de origem quando necessário.

Nenhuma mensagem, nota, observação ou resumo existente será movido ou apagado.

## Dados novos
Criar uma estrutura própria para a memória organizada por contato:
- itens de memória com escritório, contato, categoria, conteúdo, origem, confiança, estado e responsáveis pela criação/alteração;
- histórico de versões e ações para auditoria;
- marcador de processamento por contato, evitando reler repetidamente o mesmo conteúdo;
- índices por `client_id`, `contact_id`, estado e data para manter a abertura rápida.

As tabelas ficarão fechadas para acesso direto. Leitura e escrita ocorrerão por uma função protegida que valida a sessão própria do aplicativo, resolve o escritório no servidor e aplica a regra de responsável/gestor.

## Geração automática
A análise incremental considerará somente:
- mensagens recebidas do cliente;
- notas internas e observações da equipe;
- resumos anteriores como contexto acumulado.

Mensagens enviadas ao cliente pelo atendente não virarão memória automaticamente, exceto quando representarem um compromisso explícito. Cada item manterá vínculo com sua fonte para evitar duplicação e permitir conferência. Falhas da análise não afetarão o funcionamento do chat; o conteúdo original continuará disponível na linha do tempo.

## Interface
- Aba principal **Memória** com contador de novidades.
- Cabeçalho com busca, filtros por tipo e ação de atualização.
- Blocos organizados no topo e linha do tempo abaixo.
- Estados claros de carregamento, vazio, erro e somente leitura.
- Rolagem própria, adequada ao painel lateral e ao modo móvel.
- Atualização em tempo real quando outro usuário do escritório adicionar ou corrigir uma memória.

## Implementação técnica
1. Criar as tabelas, índices e regras de acesso da memória, com acesso de serviço e bloqueio de leitura pública direta.
2. Criar uma função de painel protegida pelo mesmo validador de sessão própria já usado no projeto, com ações de listar, atualizar, incluir, editar e arquivar.
3. Implementar extração incremental com o provedor de IA já configurado para resumos, resposta estruturada validada e deduplicação por fonte.
4. Criar hooks e componentes compartilhados para que os dois painéis de chat usem a mesma interface e regras.
5. Adicionar `memory` aos estados persistidos da barra direita e migrar preferências antigas da aba `resumos` para a nova aba quando aplicável.
6. Incorporar os resumos existentes à nova aba e remover apenas a aba duplicada de Resumos dentro de Contato.

## Validação
- Confirmar que o mesmo contato reúne dados de conversas diferentes.
- Confirmar a separação entre fala do cliente, nota interna, observação e resumo.
- Confirmar que usuários do mesmo escritório visualizam e usuários de outro escritório não acessam.
- Confirmar que responsável e gestores editam; demais usuários veem somente leitura.
- Confirmar origem, autoria, datas, deduplicação, auditoria e atualização em tempo real.
- Confirmar que mensagens e notas continuam funcionando mesmo quando a geração automática falha.
- Validar o painel no desktop e no celular, incluindo listas longas.
