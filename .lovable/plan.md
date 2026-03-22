
Objetivo: tirar a telefonia do estado “meia integração” e deixar fluxo real funcionando (criar ramal na Api4Com, registrar SIP, discar, receber webhook, atualizar histórico).

Diagnóstico confirmado no código/logs atuais
- O proxy retorna `200` mesmo quando a Api4Com devolve erro (`{"data":{"error":...}}`), então o frontend mostra “Chamada iniciada” falso.
- O frontend espera `data.error`, mas recebe erro aninhado em `data.data.error` (contrato inconsistente).
- Ramais locais estão sendo salvos sem `api4com_ramal` e `api4com_password` (por isso `get_sip_credentials` falha).
- Discagem está usando alias local (1001) sem garantia de vínculo real.
- Webhook não está alimentando histórico (sem eventos recebidos) e a identificação de `cod_agent` no webhook está frágil.
- Domínio SIP está confuso: REST usa host da API, SIP deve usar domínio da conta/ramal.

Plano de correção (implementação)
1) Blindar backend de telefonia (`supabase/functions/api4com-proxy/index.ts`)
- Criar helper único de request para Api4Com que:
  - valida `response.ok`
  - valida payload com `error`
  - lança erro com mensagem real da Api4Com (não retorna falso sucesso).
- Padronizar retorno do proxy (sem ambiguidade) para todas as actions.
- `dial`:
  - aceitar `extensionId` (preferencial) e resolver ramal real no backend;
  - usar `api4com_ramal` como origem;
  - se ramal não estiver vinculado, bloquear com erro claro (“Ramal sem vínculo Api4Com”);
  - gravar log como `failed` quando Api4Com rejeitar; `initiated` só quando aceitar.
- `create_extension`:
  - validar presença de `id`, `ramal`, `senha`;
  - não permitir continuar se payload vier incompleto.
- `get_sip_credentials`:
  - se credenciais locais faltarem, tentar auto-hidratar via `/extensions` da Api4Com e atualizar `phone_extensions`;
  - retornar `domain` correto para SIP (domínio da conta/ramal), não host REST.
- Adicionar action `sync_extensions`:
  - listar ramais reais da Api4Com e fazer upsert em `phone_extensions` (id, ramal, senha, vínculo).
  - Corrigir os registros já quebrados (nulos) sem depender de recriação manual.

2) Fechar ciclo de webhook (`api4com-proxy` + `api4com-webhook`)
- `setup_webhook`:
  - configurar eventos `channel-create`, `channel-answer`, `channel-hangup`;
  - remover restrição que bloqueia eventos legítimos (ou garantir metadata obrigatória em toda origem).
- `dial` deve sempre enviar metadata com `cod_agent` para correlação.
- `api4com-webhook/index.ts`:
  - robustecer parser dos formatos de evento;
  - resolver `cod_agent` por prioridade: metadata -> domínio da conta -> ramal/caller;
  - upsert por `call_id` e atualizar status em sequência (`initiated` -> `answered` -> `hangup`/`failed`).

3) Ajustar frontend para contrato real (`src/pages/telefonia` + CRM)
- `useTelefoniaData.ts`:
  - adaptar leitura do retorno padronizado do proxy;
  - em criação de ramal: só inserir local após sucesso validado da Api4Com;
  - em dial: nunca mostrar sucesso se backend sinalizar falha.
- `DiscadorTab.tsx` e `PhoneCallDialog.tsx`:
  - enviar `extensionId` (não string de ramal digitada/local);
  - fallback REST só quando fizer sentido; com erro explícito quando extensão não estiver registrada/vinculada.
- `MeusRamaisTab.tsx`:
  - botão “Sincronizar ramais Api4Com”;
  - indicador visual de ramal integrado vs ramal sem vínculo.
- Mensagens UX diretas (sem falso positivo): “Ramal não registrado”, “Credenciais SIP ausentes”, “Webhook não configurado”.

4) Correções de consistência de dados
- Rodar sincronização para popular `api4com_id`, `api4com_ramal`, `api4com_password` nos ramais já criados.
- Evitar duplicidades com validação de upsert por `cod_agent + api4com_id` (e fallback por `cod_agent + api4com_ramal`).

5) Ordem de execução
- Etapa A: proxy robusto + contrato de erro/sucesso.
- Etapa B: sync de ramais + credenciais SIP automáticas.
- Etapa C: webhook setup + webhook parser/correlação.
- Etapa D: frontend (discador, CRM, mensagens, botão sync).
- Etapa E: validação E2E completa.

Critérios de aceite (E2E)
- Criar ramal gera vínculo real (campos Api4Com preenchidos).
- Selecionar ramal retorna credenciais SIP válidas.
- Discar não mostra sucesso falso; erro real aparece quando houver rejeição.
- Chamada bem-sucedida atualiza histórico por webhook (create/answer/hangup).
- Card CRM e módulo Telefonia disparam chamada com mesmo fluxo integrado.
