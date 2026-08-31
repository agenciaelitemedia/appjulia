# LÍDIA — Copiloto de vendas na barra lateral do chat

IA especialista em vendas que conduz o atendente passo a passo até o fechamento do contrato. O atendente não precisa saber direito, vendas ou tecnologia: a LÍDIA pensa o caso junto com ele e diz exatamente o que fazer, o que perguntar e o que responder. Vive como uma nova aba na barra lateral direita do chat, em formato de conversa.

## Experiência do atendente

Nova aba "LÍDIA" na barra lateral direita (ao lado de Contato / CRM / Telefonia / Julia), com:

- **Cabeçalho de fase**: fase atual do fechamento detectada pela LÍDIA (Abertura → Diagnóstico do caso → Análise jurídica → Proposta/Valor → Objeções → Fechamento/Contrato → Pós-assinatura), com barra de progresso discreta.
- **Painel "Próximo passo"** (sempre no topo): 1 única ação clara, em linguagem de pessoa, sem termos técnicos. Exemplo: "Pergunte ao cliente quando o problema começou" em vez de "Colete a data dos fatos".
- **Sugestões acionáveis** em cartões:
  - *Perguntas a fazer* — na fase de diagnóstico, lista de perguntas prontas para copiar/enviar, uma de cada vez, com explicação curta do porquê perguntar isso.
  - *Resposta sugerida* — texto pronto para o atendente revisar/enviar, com indicação de quando usá-la.
  - *Análise jurídica* — possibilidades jurídicas explicadas de forma simples, com força do caso (forte / médio / fraco / inconclusivo), provas necessárias e riscos (prescrição) traduzidos para o atendente entender.
  - *Objeção detectada* — quando o cliente objeta (preço, desconfiança, "vou pensar"), a LÍDIA mostra a técnica de contorno + fala sugerida, sem jargão de vendas.
  - *Roteiro de ligação* — quando há objeção forte ou silêncio do cliente, a LÍDIA recomenda ligar e exibe um roteiro passo a passo (abertura, pontos-chave, contorno, fechamento), com botão que já dispara a discagem existente (ZAP Call / VoIP) para aquele contato.
- **Chat livre com a LÍDIA**: o atendente pode perguntar qualquer coisa ("não entendi", "o que significa prescrição?", "como respondo isso?", "vale a pena o caso?") e ela responde de forma didática, sempre no contexto da conversa carregado.
- **Botão "Reanalisar"** para atualizar as sugestões com as mensagens mais recentes.
- **Confirmação de entendimento**: a LÍDIA pode perguntar ao atendente "Ficou claro?" ou "Me diz com suas palavras o que você entendeu" para garantir que ele não vai seguir no automático sem compreender.

Comportamento automático (sem custo desnecessário):
- A análise roda ao abrir a aba, ao clicar em Reanalisar e quando chegarem novas mensagens do cliente enquanto a aba estiver aberta (com debounce e mínimo de mensagens novas).
- Gatilho de silêncio: se o cliente não responde há X minutos (configurável, padrão 30) e havia negociação em andamento, a LÍDIA marca "cliente parou de responder" e já sugere ligação + roteiro.

## Como a LÍDIA entende o caso

Contexto montado no servidor a cada análise:
- **Agente da fila da conversa** (fonte principal de orientação): a LÍDIA identifica a fila da conversa, resolve o agente vinculado (`queue_agent_links` → agente/`cod_agent`) e usa o prompt/configuração desse agente — como ele se apresenta, áreas de atuação, política de honorários, regras de qualificação e fluxo de contrato — como base das orientações. Assim as sugestões seguem o mesmo discurso do agente daquela fila, não um script genérico.
- Fila sem agente vinculado: a LÍDIA cai para o perfil de vendas do escritório (configurável) e, na falta dele, para um padrão jurídico genérico — sempre avisando no painel que está sem o agente da fila.
- Resumos já persistidos da conversa (aba Resumo) como memória acumulada.
- Últimas N mensagens da conversa, com transcrição de áudios quando existir.
- Dados do contato, fila/canal, card do CRM vinculado (etapa, valor, responsável) e histórico de fases já registradas pela LÍDIA.

## Tom e linguagem

A LÍDIA fala com o atendente, não com um advogado ou vendedor experiente:
- **Zero jargão**: termos como "prescrição", "liquidação", "honorários de êxito" vêm acompanhados de explicação curta.
- **Instruções acionáveis**: cada sugestão começa com um verbo ("Pergunte...", "Explique...", "Ligue...") e termina com o objetivo ("...para descobrir se o caso ainda está dentro do prazo").
- **Sem suposição de conhecimento**: a LÍDIA explica o porquê de cada pergunta e o que fazer com a resposta.
- **Tom parceiro, não robótico**: usa linguagem calorosa, como um colega experiente ao lado do atendente.
- **Feedback visual de confiança**: cada sugestão mostra o nível de confiança da LÍDIA e avisa quando a informação ainda é incompleta ("Preciso que o cliente confirme isso").

## Saída estruturada

A IA responde em JSON estruturado (fase, próximo passo, perguntas com explicação do porquê, resposta sugerida, análise jurídica simplificada, objeções, necessidade de ligação + roteiro, confiança, avisos de informação incompleta), e a UI renderiza cada bloco em cartão. Nada de "parede de texto".

## Detalhes técnicos

**Backend (Edge Function nova `lidia-copilot`)**
- Ações: `analyze` (gera a orientação estruturada da conversa), `chat` (pergunta livre do atendente com o mesmo contexto), `call_script` (roteiro de ligação sob demanda).
- Reaproveita o padrão já existente: `_shared/aiGateway.ts` (`resolveAI` + `providerHeaders`, com fallback OpenRouter), `_shared/aiUsageLogger.ts` (`logAIUsage`) e prompt configurável por cliente em `client_ai_model_config` / editor de prompts das features de IA.
- Monta o transcript reaproveitando a lógica de `chat-ai-assist` (renderMessageForTranscript + resumos anteriores).
- Valida `conversation_id` e escopo por `client_id` antes de responder; CORS padrão do projeto.

**Banco (nova migration, com GRANTs + RLS no padrão do projeto)**
- `lidia_sessions`: uma linha por conversa — fase atual, última análise (JSONB), confiança, `updated_at`, `client_id`, `conversation_id` (único).
- `lidia_messages`: histórico do chat da LÍDIA por conversa (role, content, created_at) para continuidade.
- `lidia_client_config`: perfil de vendas por escritório (áreas, faixas de honorários, argumentos, política de desconto, minutos de silêncio, ativar/desativar).

**Frontend**
- `src/modules/lidia/` (módulo próprio, com `extend/` reexportando chat/auth/ui como nos módulos existentes):
  - `components/LidiaPanel.tsx` (aba completa), `LidiaPhaseHeader`, `LidiaSuggestionCard`, `LidiaCallScriptCard`, `LidiaChatThread`.
  - `hooks/useLidia.ts` (React Query: análise, chat, reanalisar, realtime das mensagens do contato para disparar reanálise).
- `ChatRightBar.tsx`: adiciona a aba `lidia` na lista de abas (ícone próprio, não `Sparkles`) e renderiza `LidiaPanel` — sem alterar as abas atuais.
- Envio de sugestão para o composer via o mesmo mecanismo já usado pelas mensagens rápidas (preenche o `ChatInput`, atendente confirma).
- Ligação usa os componentes de discagem existentes (`WavoipCallButton` / dialer do header), sem nova integração de telefonia.
- Página de configuração `/admin/lidia` (ou aba dentro das configurações de IA do chat) para o perfil de vendas e prompt, com auto-registro de módulo (`useEnsureLidiaModule`) no padrão do projeto.

**Custos e limites**
- Análise apenas com a aba aberta + debounce; cache da última análise em `lidia_sessions` para reabrir sem gastar chamada.
- Erros da IA (402/403/429) são exibidos no painel com a mensagem real, reutilizando o padrão de alerta de cobrança já existente.

## Liberação restrita (piloto)

- Na primeira fase, a aba LÍDIA aparece **somente** para a conta `tellmoitas@gmail.com`. Para qualquer outro usuário nada muda no chat (nenhuma aba extra, nenhuma chamada de IA).
- Gate em dois níveis: no frontend, a aba só é montada quando o e-mail do usuário autenticado está na allowlist; na Edge Function, a mesma allowlist é verificada no servidor antes de qualquer chamada de IA (bloqueio real, não só visual).
- A allowlist fica em um único ponto (`src/modules/lidia/access.ts` + constante espelhada na função), pronta para virar permissão de módulo/flag por escritório quando o piloto for aprovado.

## Entrega em etapas


1. Migration + Edge Function `lidia-copilot` (analyze/chat) e contexto reaproveitando resumos e mensagens.
2. Aba LÍDIA no `ChatRightBar` com fase, próximo passo, perguntas e resposta sugerida (com envio ao composer).
3. Análise jurídica, detecção de objeção e roteiro de ligação com botão de discagem.
4. Chat livre com histórico persistido + gatilho de silêncio.
5. Tela de configuração (perfil de vendas, prompt, ativar/desativar por escritório).
