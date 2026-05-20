# Corrigir uso do prompt configurado no auto-resumo

## Objetivo
Garantir que o auto-resumo use exatamente o prompt configurado em **Configurações → IA's → Resumo de Conversa**, em vez de cair no prompt padrão do sistema.

## Diagnóstico
Hoje a função de backend **já tem suporte** para buscar o prompt configurado em `client_ai_model_config` com a feature `chat_resume`.

O problema está nas chamadas do app:
- **auto-resumo** (`incremental_summary`) é invocado sem `client_id`
- **geração manual** (`full_summary`) também é invocada sem `client_id`

Sem `client_id`, a função `getPrompt(client_id, 'chat_resume', DEFAULT_RESUME_PROMPT)` retorna o fallback padrão. Isso explica o comportamento observado e o tipo de saída genérica que você mostrou.

## O que implementar
1. Ajustar a chamada do **auto-resumo** para enviar `client_id` do usuário autenticado.
2. Ajustar a chamada do **resumo manual** para também enviar `client_id`.
3. Revisar o fluxo para que ambos os modos usem a mesma origem de configuração (`chat_resume`) de forma consistente.
4. Validar se o resumo retornado passa a refletir o prompt customizado salvo em configurações.

## Arquivos envolvidos
- `src/hooks/useAutoSummaryOnStatusChange.ts`
- `src/hooks/useConversationSummaries.ts`
- `supabase/functions/chat-ai-assist/index.ts` (apenas conferência; a lógica principal já está preparada)

## Resultado esperado
Após a correção:
- auto-resumo ao resolver/encerrar conversa usará o prompt customizado
- resumo manual também usará o mesmo prompt customizado
- a saída deixará de seguir o texto padrão do sistema quando houver prompt salvo para o cliente

## Detalhes técnicos
- A edge function busca configuração por:
  - tabela: `client_ai_model_config`
  - chave: `client_id + feature='chat_resume'`
- O bug ocorre porque as invocações atuais enviam apenas:
  - `mode`
  - `conversation_id`
  - `after_ts` / `triggered_by`
- Falta incluir no body:
  - `client_id: String(user.client_id)`

## Validação
Depois da implementação, testar:
1. salvar um prompt claramente diferente em **Resumo de Conversa**
2. disparar auto-resumo numa conversa
3. confirmar que o texto gerado segue o prompt salvo
4. repetir no botão manual de gerar resumo para garantir consistência