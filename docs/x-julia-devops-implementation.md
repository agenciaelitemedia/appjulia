# Documento de Requisitos e Arquitetura DevOps - X-Julia

Este documento detalha as mudanças arquiteturais e de infraestrutura necessárias para que o módulo **X-Julia** atinja escalabilidade, segurança e previsibilidade de custos. O foco deste documento é fornecer uma análise profunda dos requisitos e das modificações sistêmicas, servindo como guia claro para a equipe de desenvolvimento e para a orquestração via Lovable.

---

## 1. Desacoplamento do Processamento de Webhooks (Assincronicidade)

### Contexto e Risco de Negócio
Atualmente, quando uma integradora (como a UaZapi) envia uma mensagem via Webhook para a rota `x-julia-engine`, o sistema processa toda a inteligência artificial (LLM) e a geração de áudio (TTS) antes de devolver uma resposta HTTP 200. Como provedores de mensageria exigem respostas rápidas (geralmente sob 5 segundos), chamadas demoradas de IA causarão *timeouts*. Isso resulta na integradora tentando reenviar a mesma mensagem repetidas vezes, gerando custos duplicados e spam para o cliente final.

### Análise de Requisitos (As-Is vs To-Be)
- **As-Is:** A função `x-julia-engine` recebe o payload, roda o agente (LLM), gera o áudio (ElevenLabs), dispara a resposta para o WhatsApp e só então finaliza a requisição HTTP.
- **To-Be:** A função `x-julia-engine` deve atuar apenas como um "Receptor". Ela deve validar a origem da mensagem, enfileirar o payload de forma segura e retornar HTTP 200 imediatamente. Um serviço paralelo (Worker) deve consumir essa fila no seu próprio tempo.

### Modificações Necessárias
1. **Criação de Fila (Queue/Broker):** Instanciar um mecanismo de fila no Supabase (como pgmq, Redis, ou Supabase Edge Queues).
2. **Refatoração do Receptor (`x-julia-engine`):** Remover a importação e a chamada da função `runXJTurn` desta rota. Substituir pela inserção do payload na fila.
3. **Criação de Worker (`x-julia-processor`):** Criar uma nova Edge Function dedicada a processar a fila. Esta função herdará toda a lógica atual do `runXJTurn`, garantindo que não há limite de tempo estrito atrelado à requisição original do usuário.
4. **Impacto Lovable:** A nova arquitetura exigirá que o Lovable faça o deploy de duas Edge Functions distintas e orquestre as permissões para que o Worker consiga acessar o banco de dados.

---

## 2. Concorrência e Escalonamento no Disparo de Follow-ups

### Contexto e Risco de Negócio
O sistema de *follow-up* (retorno ativo ao lead) busca tarefas pendentes e as processa. Atualmente, o script processa cada lead um após o outro, aguardando o processamento do anterior terminar. Se a base crescer para centenas de leads agendados para o mesmo horário, a Edge Function do Supabase atingirá seu tempo máximo de vida (timeout) antes de terminar a fila, deixando clientes sem resposta.

### Análise de Requisitos (As-Is vs To-Be)
- **As-Is:** O script usa um laço de repetição sequencial (`for ... await`) limitando a 40 registros por vez.
- **To-Be:** O sistema deve processar lotes de leads em paralelo (concorrência controlada) para maximizar o uso da CPU e da rede, finalizando o lote inteiro muito antes do timeout da nuvem.

### Modificações Necessárias
1. **Implementação de Paralelismo Controlado:** Alterar a lógica do `x-julia-followup-runner` para agrupar as promessas de envio (usando recursos como `Promise.allSettled`).
2. **Limitação de Taxa de Saída (Throttling):** Para não sobrecarregar as APIs externas (WhatsApp e OpenAI) com chamadas simultâneas brutais, deve-se implementar um limitador de concorrência (ex: processar blocos de 10 em 10 leads paralelamente).
3. **Tratamento de Falhas Isoladas:** Garantir que se o follow-up do Lead A falhar, o lote continue processando os Leads B e C, registrando a falha do A no banco de dados para repescagem.

---

## 3. Gestão de Custos e Prevenção contra Abusos (FinOps)

### Contexto e Risco de Negócio
As APIs de LLM e TTS (Text-to-Speech) cobram por uso (tokens/caracteres). Atualmente, a X-Julia responde a qualquer estímulo sem um teto financeiro. Um ataque malicioso, um bot, ou um erro de configuração no WhatsApp pode enviar milhares de mensagens, gerando milhares de dólares em custos não planejados em poucas horas.

### Análise de Requisitos (As-Is vs To-Be)
- **As-Is:** O custo de cada interação é calculado e salvo em `xj_sessions`, mas atua apenas como um medidor (leitura).
- **To-Be:** O medidor deve atuar como um disjuntor (Circuit Breaker). Deve existir um limite de interações por minuto/hora para cada lead, e um limite de custo total diário por inquilino (tenant).

### Modificações Necessárias
1. **Controle de Taxa (Rate Limiter):** Criar uma lógica no banco de dados ou via cache em memória que contabilize quantas mensagens o `client_id` processou na última hora.
2. **Circuit Breaker:** Modificar o motor principal (`runner.ts`). Antes de enviar a requisição para a OpenAI, o sistema deve consultar se o limite diário financeiro do tenant foi excedido.
3. **Fallback e Alerta:** Caso o limite seja atingido, a X-Julia deve pausar a sessão automaticamente, não realizar chamadas externas, responder ao usuário final com uma mensagem padrão de "Sistema em manutenção" e disparar um alerta para o dashboard do Lovable (para que o administrador intervenha).

---

## 4. Segurança de Endpoints e Isolamento (Hardening)

### Contexto e Risco de Negócio
A configuração do projeto (`supabase/config.toml`) atualmente define que a verificação de tokens JWT está desativada para a maioria das funções. Embora Webhooks de terceiros não enviem o JWT do seu aplicativo, deixar funções internas expostas publicamente permite que qualquer pessoa dispare as funções e manipule os agentes caso descubra a URL.

### Análise de Requisitos (As-Is vs To-Be)
- **As-Is:** Edge Functions públicas, confiando apenas em regras internas de negócio.
- **To-Be:** Acesso estritamente controlado. Apenas provedores homologados (com validação de assinatura ou IP) podem chamar webhooks. Funções internas devem exigir JWT.

### Modificações Necessárias
1. **Ativação de JWT:** No `config.toml`, as funções que servem ao frontend do Lovable devem ter a verificação JWT obrigatoriamente ativada.
2. **Validação de Assinatura nos Webhooks:** No webhook do WhatsApp, deve-se implementar a validação do hash/assinatura criptográfica que o provedor envia no cabeçalho (Header) para garantir que o POST não foi forjado por um invasor.
3. **Mapeamento no Lovable:** O Lovable deve ser configurado para enviar corretamente os headers de Autorização para todas as chamadas de API feitas a partir do painel administrativo.

---

## 5. Ciclo de Vida dos Dados e Performance do Banco

### Contexto e Risco de Negócio
O sistema de log salva tudo na tabela `xj_session_events`. Em produção, com múltiplos agentes operando, essa tabela crescerá em milhões de linhas muito rapidamente. Bancos de dados sem particionamento sofrem degradação severa de performance em tabelas massivas, o que deixará o carregamento das telas do Lovable extremamente lento.

### Análise de Requisitos (As-Is vs To-Be)
- **As-Is:** Tabela única, monolítica, acumulando logs desde a implantação.
- **To-Be:** Dados recentes e "quentes" ficam em tabelas rápidas para exibição imediata no Lovable. Dados antigos são arquivados para não prejudicar as buscas.

### Modificações Necessárias
1. **Estratégia de Particionamento:** Transformar a tabela `xj_session_events` em uma tabela particionada por data (ex: partições mensais) usando as capacidades nativas do PostgreSQL.
2. **Rotinas de Limpeza (Cron):** Criar uma procedure no Supabase acionada por `pg_cron` para varrer eventos mais velhos que 90 dias, movendo-os para um schema de backup ou deletando registros não-essenciais.
3. **Criação de Índices Otimizados:** Adicionar índices compostos nas colunas que o painel Lovable mais consulta simultaneamente (ex: filtragem de logs por `session_id` e data descendente).

---

## Resumo das Modificações para o Planejamento

Para executar essas mudanças de forma segura e incremental, a ordem sugerida de desenvolvimento é:

1. **Sprint 1 (Estabilidade Imediata):** Desacoplamento assíncrono do `x-julia-engine` e implementação da Fila de processamento.
2. **Sprint 2 (Escalabilidade e Custos):** Paralelização do `x-julia-followup-runner` e implementação das travas do Disjuntor (Circuit Breaker).
3. **Sprint 3 (Segurança e DBA):** Hardening de endpoints com JWT e particionamento da tabela de logs.
