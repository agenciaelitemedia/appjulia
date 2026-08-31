# LÍDIA — Copiloto de vendas na barra lateral do chat

IA especialista em vendas que acompanha o atendimento em tempo real e orienta o atendente até o fechamento do contrato. Vive como uma nova aba na barra lateral direita do chat, em formato de conversa.

## Experiência do atendente

Nova aba "LÍDIA" na barra lateral direita (ao lado de Contato / CRM / Telefonia / Julia), com:

- **Cabeçalho de fase**: fase atual do funil de fechamento detectada pela LÍDIA (Abertura → Diagnóstico do caso → Análise jurídica → Proposta/Valor → Objeções → Fechamento/Contrato → Pós-assinatura), com barra de progresso discreta.
- **Painel "Próximo passo"** (sempre no topo): 1 ação recomendada agora, em uma frase.
- **Sugestões acionáveis** em cartões:
  - *Perguntas a fazer* — na fase de diagnóstico, lista de perguntas específicas do caso, cada uma com botão "Enviar" (joga no composer do chat, não envia direto) e "Copiar".
  - *Resposta sugerida* — texto pronto para o atendente revisar/enviar, depois que o cliente respondeu às perguntas.
  - *Análise jurídica* — possibilidades jurídicas identificadas, provas necessárias, riscos (prescrição), força do caso (forte / médio / fraco / inconclusivo).
  - *Objeção detectada* — quando o cliente objeta (preço, desconfiança, "vou pensar"), a LÍDIA mostra a técnica de contorno + fala sugerida.
  - *Roteiro de ligação* — quando há objeção forte ou silêncio do cliente, a LÍDIA recomenda ligar e exibe um roteiro (abertura, pontos-chave, contorno, fechamento), com botão que já dispara a discagem existente (ZAP Call / VoIP) para aquele contato.
- **Chat livre com a LÍDIA**: o atendente pode perguntar qualquer coisa ("como respondo isso?", "vale a pena o caso?") e ela responde com o contexto da conversa carregado.
- **Botão "Reanalisar"** para atualizar as sugestões com as mensagens mais recentes.

Comportamento automático (sem custo desnecessário):
- A análise roda ao abrir a aba, ao clicar em Reanalisar e quando chegarem novas mensagens do cliente enquanto a aba estiver aberta (com debounce e mínimo de mensagens novas).
- Gatilho de silêncio: se o cliente não responde há X minutos (configurável, padrão 30) e havia negociação em andamento, a LÍDIA marca "cliente parou de responder" e já sugere ligação + roteiro.

## Como a LÍDIA entende o caso

Contexto montado no servidor a cada análise:
- Resumos já persistidos da conversa (aba Resumo) como memória acumulada.
- Últimas N mensagens da conversa, com transcrição de áudios quando existir.
- Dados do contato, fila/canal, card do CRM vinculado (etapa, valor, responsável) e histórico de fases já registradas pela LÍDIA.
- Perfil de vendas do escritório (áreas de atuação, faixas de honorários, argumentos e políticas de desconto) configurável — sem isso ela usa um padrão jurídico genérico.

## Saída estruturada

A IA responde em JSON estruturado (fase, próximo passo, perguntas, resposta sugerida, análise jurídica, objeções, necessidade de ligação + roteiro, confiança), e a UI renderiza cada bloco em cartão. Nada de "parede de texto".

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

## Entrega em etapas

1. Migration + Edge Function `lidia-copilot` (analyze/chat) e contexto reaproveitando resumos e mensagens.
2. Aba LÍDIA no `ChatRightBar` com fase, próximo passo, perguntas e resposta sugerida (com envio ao composer).
3. Análise jurídica, detecção de objeção e roteiro de ligação com botão de discagem.
4. Chat livre com histórico persistido + gatilho de silêncio.
5. Tela de configuração (perfil de vendas, prompt, ativar/desativar por escritório).
