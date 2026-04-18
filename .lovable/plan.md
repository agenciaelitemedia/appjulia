

## Diagnóstico
A criação de fila **API Oficial (WABA)** já existe end-to-end, mas tem fricções:

1. **Provedor WABA é manual demais**: o `ProviderFormDialog` pede `Meta App ID/Secret/WABA Business ID/Access Token` digitados à mão. Não há atalho para usar o Embedded Signup (que já existe em `WabaSetupDialog` no módulo de Agentes) nem para reaproveitar o app global (`META_APP_ID/META_APP_SECRET` já estão como secrets do projeto).
2. **Phone Number ID é opaco**: no Wizard (passo 2 WABA), o usuário precisa **digitar manualmente** o `Phone Number ID`. Não há listagem dos números disponíveis na conta WABA daquele provedor.
3. **Sem validação prévia**: nada confirma que o token + business_id + phone_number_id batem antes de criar a fila — erro só aparece quando chega mensagem.
4. **Falta feedback de webhook**: usuário não sabe se a URL `meta-webhook` está configurada no app Meta dele.

## Objetivo
Deixar o fluxo "Criar fila API Oficial" 100% guiado e funcional, com 2 caminhos:
- **Atalho rápido**: usar o app Meta global da Julia (Embedded Signup) → cria provider + fila em um único fluxo.
- **Manual avançado**: app Meta próprio do cliente (mantém formulário atual, mas com seletor de números e teste de conexão).

## Mudanças

### 1. `supabase/functions/waba-admin` — adicionar 2 actions
- `list_phone_numbers`: recebe `{ wabaBusinessId, accessToken }` → chama `GET /{waba_id}/phone_numbers` e devolve `[{ id, display_phone_number, verified_name, quality_rating }]`. Permite popular dropdown no Wizard.
- `test_credentials`: recebe `{ wabaBusinessId, accessToken, phoneNumberId }` → faz `GET /{phone_number_id}` validando token/permissões. Devolve `{ success, phone, error }`.

### 2. `ProviderFormDialog.tsx` (provedor WABA)
Adicionar topo do bloco WABA um botão **"Conectar via Meta (recomendado)"** que dispara o mesmo fluxo de Embedded Signup já existente (`WabaSetupDialog` lógica) **adaptado para gravar em `queue_providers`** em vez da tabela `agents`:
- Reaproveita `META_APP_ID` / `META_CONFIG_ID` do `.env`.
- Após sucesso, preenche automaticamente `meta_app_id` (global), `waba_business_id` e `waba_token`. Esconde os campos manuais (mostra só leitura com botão "Reconectar").
- Mantém formulário manual recolhido em `<Collapsible>Configuração avançada</Collapsible>` para quem quer usar app próprio.

Criar componente reutilizável `src/components/waba/WabaEmbeddedSignupButton.tsx` extraindo a lógica de `WabaSetupDialog` (FB SDK, listener de message, troca de token via `waba-admin/exchange_token`) com callback `onSuccess({ wabaBusinessId, accessToken, phoneNumberId, displayPhone })`. Vai ser usado tanto no provider quanto no wizard.

### 3. `QueueWizardDialog.tsx` (passo 2 — WABA)
Substituir o `<Input>` cru de Phone Number ID por:
- Quando provedor WABA selecionado → chamar `waba-admin/list_phone_numbers` com `waba_business_id` + `waba_token` do provedor.
- Renderizar `<Select>` com os números (formato: `+55 11 9XXXX-XXXX — Verified Name`). Salva `phone_number_id` no estado.
- Mostrar `quality_rating` (badge verde/amarelo/vermelho).
- Botão **"Testar conexão"** que chama `waba-admin/test_credentials` antes de prosseguir → toast verde/vermelho.
- Caso o provedor não tenha token válido, mostra alerta com link "Reconectar provedor" que abre o Embedded Signup novamente.

Adicionar também atalho: se nenhum provedor WABA existe, oferecer botão **"Conectar agora via Meta"** direto no passo 2 (cria provider on-the-fly via Embedded Signup, depois segue o wizard).

### 4. `src/pages/agente/filas/components/QueueCard.tsx`
Adicionar badge de status para filas WABA: ícone azul + "API Oficial" + (se conectada) número verificado. Botão "Testar" que chama a mesma `test_credentials`.

### 5. Memória
Atualizar `mem://integrations/meta/waba-embedded-signup` com nota de que o Embedded Signup é reutilizado em **3 lugares**: agentes (legado), provedores de fila, wizard de fila.

## Pré-requisitos (já atendidos)
- Secrets já configurados: `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`.
- `.env` com `VITE_META_APP_ID` e `VITE_META_CONFIG_ID`.
- Edge functions `waba-admin`, `meta-webhook`, `waba-send` já operacionais.
- Tabela `queue_providers` com colunas WABA já existe.
- Tabela `queues` com `waba_id/waba_token/waba_number_id` já existe.
- `resolveQueueByWabaNumberId` já roteia mensagens recebidas para a fila correta.

**Nada de DB/secret novo — só código frontend + 2 actions na edge `waba-admin`.**

## Arquivos a editar/criar
- `supabase/functions/waba-admin/index.ts` (+2 actions)
- `src/components/waba/WabaEmbeddedSignupButton.tsx` (novo, ~120 linhas — extraído de `WabaSetupDialog`)
- `src/pages/configuracoes/components/ProviderFormDialog.tsx` (botão Embedded Signup + formulário avançado colapsável)
- `src/pages/agente/filas/components/QueueWizardDialog.tsx` (Select de phone numbers + botão Testar + atalho criar provider)
- `src/pages/agente/filas/components/QueueCard.tsx` (badge + teste de conexão WABA)
- `mem://integrations/meta/waba-embedded-signup` (atualização)

## Validação
1. **Fluxo rápido**: Configurações → Novo Provedor → "WABA" → "Conectar via Meta" → Embedded Signup → provider salvo com token e business_id.
2. Filas → Nova Fila → "API Oficial (WABA)" → seleciona provider → dropdown lista os números → escolhe → "Testar" mostra ✓ → cria fila.
3. **Mensagem entra**: enviar mensagem de teste pro número escolhido → `meta-webhook` recebe → `resolveQueueByWabaNumberId` encontra a fila → conversa aparece no chat com a fila correta.
4. **Mensagem sai**: enviar texto pelo chat → `waba-send` usa `waba_token` + `waba_number_id` da fila → entrega no WhatsApp.
5. **Caminho manual**: criar provider WABA com app próprio (Meta App ID/Secret/Token manuais) → mesmo wizard funciona.
6. **Sem provedor**: wizard oferece "Conectar agora" e cria provider in-line.

