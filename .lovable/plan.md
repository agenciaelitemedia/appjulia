# X-Julia — o que ainda falta

O motor (backend) e a base de dados estão prontos. Falta a maior parte do painel de configuração, o registro do módulo no app e a ativação do robô de followup.

## Já pronto

- Banco: todas as tabelas `xj_*` (agentes, prompts, casos, perguntas, base de conhecimento, gatilhos CTA, vínculo com filas, sessões, eventos, cadências/passos/fila de followup, CRM próprio, contratos, agenda, skills).
- Motor: `x-julia-engine` (turno completo com skills), `x-julia-followup-runner`, `x-julia-admin`, e o gancho no webhook de mensagens.
- Frontend: pontes `extend/`, hooks de dados dos 5 domínios, e as telas Painel, Atendimentos, Detalhe do atendimento e Agentes.

## Etapa 1 — Ligar o módulo no aplicativo

Hoje nada disso aparece no menu nem responde nas URLs.

- Registrar as rotas do X-Julia no app (painel, atendimentos, detalhe, agentes, editor do agente, casos, CRM, contratos, agenda e a página pública de assinatura), protegidas pelo módulo `x_julia`.
- Chamar o auto-registro do módulo no menu lateral (grupo INTELIGÊNCIA), como já é feito nos outros módulos.
- Incluir `x_julia` no pacote de módulos liberados para Escritórios.

## Etapa 2 — Editor do agente (tela central que falta)

Uma tela com abas para o agente:

1. **Geral** — nome, ativo, persona, tom, limite de turnos, horário de atendimento, política de repasse para humano, espelhar no CRM Builder.
2. **Inteligência** — provedor de LLM e modelo (lista já definida no módulo), fallback automático, aviso quando o provedor exige chave e link para cadastrá-la.
3. **Voz** — ativar resposta em áudio, provedor (ElevenLabs/Voicemaker), voz, teste de prévia usando `x-julia-admin`.
4. **Prompt** — prompt principal e prompts por estágio, com salvar-como-versão e histórico/rollback.
5. **Filas** — vincular o agente às filas conectadas do escritório (o motor só dispara nas filas vinculadas).
6. **Gatilhos CTA** — cadastro de gatilhos por campanha/palavra-chave, com caso sugerido e mensagem de abertura.
7. **Followup** — cadências por estágio/caso: passos com atraso, tipo (texto, áudio, imagem, vídeo, documento, link), conteúdo fixo ou gerado por IA, e ação ao esgotar.
8. **Contrato** — provedor (interno/ZapSign) e modelo padrão do agente.

## Etapa 3 — Biblioteca de casos jurídicos (exclusiva do módulo)

- Lista por categoria com busca, criar/editar/duplicar/remover.
- Editor do caso: resumo, critérios de qualificação e desqualificação, documentos exigidos, ticket mínimo e honorários.
- Roteiro de perguntas: ordenar, campo de destino do dado, obrigatoriedade.
- Base de conhecimento: texto colado ou arquivo enviado (PDF/imagem/áudio), listagem e remoção.
- Modelo de contrato por caso.
- Botão para importar os casos da biblioteca atual como ponto de partida (opcional, sem vínculo depois).

## Etapa 4 — CRM próprio do X-Julia

- Semear as etapas padrão na primeira abertura (Novo lead, Triagem, Qualificado, Negociação, Contrato enviado, Assinado, Perdido).
- Quadro kanban com arrastar entre etapas, filtro por caso e por qualificação, cartão com contato, caso, valor e tempo na etapa.
- Painel do cartão: dados do lead, histórico de movimentações, atalhos para o atendimento e para o chat.
- Configuração das etapas (nome, cor, ordem, estágio correspondente) e opção de espelhar no CRM Builder.

## Etapa 5 — Contratos e agenda

- Lista de contratos com status (rascunho, enviado, assinado, recusado), filtros e ações de reenviar/copiar link.
- Página pública de assinatura para o provedor interno: contrato renderizado, aceite com nome e documento, registro de data/IP e devolutiva ao motor.
- Agenda: configurar disponibilidade por dia da semana e duração do horário; visualizar/cancelar agendamentos criados pela skill.

## Etapa 6 — Integração com o chat

- Selo de estágio do X-Julia no cabeçalho da conversa quando existir sessão ativa.
- Painel lateral com dados coletados, últimas ações do motor e botões pausar/reativar agente e assumir atendimento.
- Ao um humano assumir e enviar mensagem manual, pausar a sessão automaticamente (mesma regra já usada com a Julia atual).

## Etapa 7 — Operação e testes

- Agendar o `x-julia-followup-runner` (a cada 5 minutos) para que os followups realmente saiam.
- Painel de monitoramento: fila de followups (pendentes, enviados, com erro) e reprocessamento manual.
- Simulador de conversa na tela do agente, usando `x-julia-admin`, para validar prompt e skills sem consumir lead real.
- Teste ponta a ponta em uma fila de homologação: mensagem recebida → recepção → triagem → qualificação → cartão no CRM → contrato → followup.

## Detalhes técnicos

- Toda a pasta `src/modules/x-julia/` permanece independente: qualquer recurso de outro módulo entra por um arquivo em `extend/`.
- Permissões via `useXJPermissions` (admin e dono do escritório passam sempre); exclusões críticas usam o padrão de dupla confirmação.
- `client_id` sempre pelo `useXJClientId` (herança de titular já tratada).
- Uploads de mídia de followup e base de conhecimento vão para o bucket `chat-media` em `x-julia/<client_id>/`.
- Nenhuma migração nova é prevista; se aparecer necessidade (ex.: coluna de auditoria da assinatura interna), ela é apresentada para aprovação antes.