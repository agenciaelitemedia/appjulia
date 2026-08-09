# Prompt do especialista TEA (BPC/LOAS)

## O que muda
O agente **Especialista — Autismo (TEA — BPC/LOAS)** do escritório atual passa a usar o prompt
completo enviado (identidade Julia / Albuquerque e Lima, máquina de estados E0–E8, perguntas
P1–P11, honorários, contrato, scripts, objeções e regras finais), no lugar do prompt genérico
de especialista.

Junto com isso:
- As **instruções por etapa** são alinhadas ao novo fluxo (qualificação = P1–P11 uma pergunta por
  mensagem; negociação = bloco de honorários só fora do horário comercial; contrato = coleta dos
  11 campos; assinatura = só dúvidas do link).
- O prompt é salvo também como **nova versão** no histórico do agente, para permitir rollback.
- Nenhum outro agente, caso jurídico, fila ou configuração é alterado.

## Ponto de atenção (nomes das ferramentas)
O prompt cita `Escalar_humano`, `Desqualificar_lead` e `CreateContract`. As skills reais do motor
X-Julia têm outros nomes (`transferir_humano`, `qualificar` com resultado desqualificado,
`gerar_contrato`). Para o agente realmente executar essas ações, o texto será mantido igual em
conteúdo e regras, apenas com os nomes das ferramentas substituídos pelos nomes reais das skills,
e as credenciais fixas de contrato (token/doc_token) saem do prompt — quem assina é a configuração
de contrato do agente, não o texto.

## Detalhes técnicos
- `UPDATE public.xj_agents SET system_prompt = <novo texto>, stage_prompts = <novas etapas>`
  para `id = 'ce677cce-81c4-4224-84ca-46ac3b0ac936'` (especialista TEA).
- `INSERT INTO public.xj_prompt_versions` com o mesmo conteúdo (versão seguinte, label
  "Prompt BPC/LOAS TEA"), para aparecer no histórico do editor.
- `system_prompt` mantém os blocos `[LITERAL_INICIO]`/`[LITERAL_FIM]` e as URLs dos vídeos como
  estão; o motor já envia texto literal e mídia por URL.
- A variável `horario_comercial` do prompt vira instrução para usar a data/hora BRT que o motor já
  injeta (skill `data_hora` + cabeçalho de contexto), sem expressão JavaScript.
