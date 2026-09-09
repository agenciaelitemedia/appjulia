# Disparos: mídia, botões e prévia nos templates

## Problemas encontrados hoje

- Ao escolher um template com mídia no assistente de campanha, **a mídia é descartada**: o wizard copia só o texto para a variante (`{ label, message_text, weight, template_id }`), então o envio sai como texto puro.
- O envio pela **API Oficial nunca usa template**: o worker chama a ação `send_template` na função `waba-send`, e essa ação **não existe** lá (só `send_text`, `send_media`, `log_outbound`, `download_media`, `mark_read`). Campanhas oficiais com template falham silenciosamente ou caem para texto.
- A ação `send_media` oficial só aceita arquivo em base64; o disparo guarda **URL** de mídia — falta o passo de baixar e subir para a Meta.
- Templates do modo Julia (não oficial) não têm **botões**, nem rodapé, nem prévia de como a mensagem vai ficar.

## O que muda para o usuário

1. **Criação de template (modo Julia)** ganha:
   - mídia (imagem, vídeo, áudio, documento) com URL e nome de arquivo;
   - rodapé opcional;
   - botões: resposta rápida (até 3) ou link/telefone (até 2), com aviso de limites;
   - **prévia ao vivo em estilo WhatsApp**, atualizando conforme se digita, com as variáveis exibidas como exemplo.
2. **Aviso de compatibilidade por canal** dentro do editor: o que funciona na API não oficial (mídia livre + botões) e o que exige template aprovado na API Oficial (botões e cabeçalho de mídia só via template Meta; áudio não é suportado em template oficial).
3. **Assistente de campanha**: ao escolher um template, mídia, rodapé e botões passam a ser levados para a variante e realmente enviados. A prévia da variante também aparece no passo de mensagem.
4. **Campanhas na API Oficial** passam a enviar templates aprovados de verdade (com parâmetros do corpo e cabeçalho de mídia), em vez de falhar.

## Detalhes técnicos

**Migração**
- `dsp_message_templates`: `footer text null`, `buttons jsonb not null default '[]'::jsonb`, `file_name text null`.
- `dsp_campaign_variants`: `footer text null`, `buttons jsonb not null default '[]'::jsonb`, `file_name text null`, `template_params jsonb` (se ainda não existir).
- Nenhuma tabela nova; GRANTs/RLS existentes preservados.

**Backend**
- `supabase/functions/waba-send/index.ts`: nova ação `send_template` (POST `/{phone_number_id}/messages` com `type: "template"`, `template.name`, `template.language.policy=deterministic`, `components` recebidos), reaproveitando resolução de credenciais, `fetchWithRetry` e o log de saída já usados por `send_text`. Nova ação `send_media_url`: baixa a URL, faz upload em `/media` e reutiliza o fluxo de `send_media` existente (sem alterar o comportamento atual de `send_media`).
- `supabase/functions/_shared/dsp-core.ts`: helper `buildOutboundPayload(queue, variant, vars)` que devolve o payload por provedor — uazapi: `/send/text`, `/send/media`, `/send/menu` (quando há botões, com `choices` no formato do provedor); oficial: `send_template` quando a campanha tem template Meta, senão `send_text`/`send_media_url`.
- `supabase/functions/dsp-campaign-worker/index.ts`: `sendMessage` passa a usar esse helper (mantendo contadores, cooldown, retry e classificação de erro intactos). Áudio + canal oficial dentro de campanha com template: marca falha permanente com motivo claro em vez de tentar.
- Redeploy de `waba-send` e `dsp-campaign-worker`.

**Frontend (isolado no módulo)**
- Novo `src/modules/disparos/components/TemplatePreview.tsx` — bolha estilo WhatsApp (cabeçalho de mídia, corpo com variáveis substituídas por exemplo, rodapé, botões), reutilizada no editor de template e no passo de mensagem do wizard.
- Novo `src/modules/disparos/components/TemplateButtonsEditor.tsx` — edição dos botões com validação de tipo/limites.
- `TemplatesTab.tsx`: editor em duas colunas (formulário + prévia), campos de rodapé/botões/nome de arquivo.
- `useDspTemplates.ts` / `useDspCampaigns.ts` / `types.ts`: novos campos persistidos e propagados.
- `CampaignWizardDialog.tsx`: ao selecionar template, copia `media_url`, `media_type`, `file_name`, `footer`, `buttons`; mostra a prévia e o aviso de compatibilidade conforme os canais escolhidos.

**Compatibilidade**
- Todos os campos novos têm padrão vazio: templates e campanhas existentes continuam funcionando exatamente como hoje.
