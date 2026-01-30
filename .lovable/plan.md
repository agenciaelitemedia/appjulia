

# Plano: Pagina de Teste para Meta Embedded Signup

## Objetivo

Criar uma pagina de teste isolada para validar todo o fluxo do **Embedded Signup da Meta** antes de integrar ao sistema de agentes. Isso permite testar sem afetar funcionalidades existentes.

## O que a Pagina de Teste Incluira

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  /admin/meta-test                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Teste de Integracao Meta WhatsApp API                              │   │
│  │  Validar o fluxo do Embedded Signup antes da implementacao final    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Etapa 1: Configuracao do App                                       │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  App ID:       [_______________________]                            │   │
│  │  Config ID:    [_______________________]                            │   │
│  │                                                                     │   │
│  │  Status SDK: ● Carregado / ○ Nao Carregado                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Etapa 2: Embedded Signup                                           │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  [  Iniciar Embedded Signup  ]                                      │   │
│  │                                                                     │   │
│  │  Eventos capturados:                                                │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ [timestamp] WA_EMBEDDED_SIGNUP: SETUP_STARTED               │   │   │
│  │  │ [timestamp] WA_EMBEDDED_SIGNUP: SETUP_STEP - business       │   │   │
│  │  │ [timestamp] WA_EMBEDDED_SIGNUP: SETUP_STEP - phone          │   │   │
│  │  │ [timestamp] WA_EMBEDDED_SIGNUP: FINISH                      │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Etapa 3: Dados Retornados                                          │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  WABA ID:          123456789012345                                  │   │
│  │  Phone Number ID:  987654321098765                                  │   │
│  │  Auth Code:        AQB...xxxxx...                                   │   │
│  │                                                                     │   │
│  │  [  Testar Troca de Token  ]                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Etapa 4: Validar Access Token                                      │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Access Token: EAAG...xxxxx... (valido)                             │   │
│  │  Expira em: Nunca (token permanente)                                │   │
│  │                                                                     │   │
│  │  [  Testar Envio de Mensagem  ]                                     │   │
│  │                                                                     │   │
│  │  Numero destino: [+55 11 99999-9999]                                │   │
│  │  Mensagem:       [Teste da Julia via Meta API]                      │   │
│  │                                                                     │   │
│  │  Resultado: ✓ Mensagem enviada com sucesso (wamid: xxx)             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Etapa 5: Testar Webhook                                            │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                     │   │
│  │  Webhook URL:                                                       │   │
│  │  https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/meta-webhook│   │
│  │  [Copiar]                                                           │   │
│  │                                                                     │   │
│  │  Verify Token: test_verify_12345                                    │   │
│  │  [Copiar]                                                           │   │
│  │                                                                     │   │
│  │  Ultimas mensagens recebidas:                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │ [10:30] De: +5511999999999 | "Ola, tudo bem?"               │   │   │
│  │  │ [10:31] De: +5511888888888 | "Preciso de ajuda"             │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/admin/meta-test/MetaTestPage.tsx` | Pagina principal de teste |
| `src/pages/admin/meta-test/components/MetaSdkLoader.tsx` | Carregador do Facebook SDK |
| `src/pages/admin/meta-test/components/EmbeddedSignupTest.tsx` | Teste do signup |
| `src/pages/admin/meta-test/components/TokenExchangeTest.tsx` | Teste de troca de token |
| `src/pages/admin/meta-test/components/MessageSendTest.tsx` | Teste de envio de mensagem |
| `src/pages/admin/meta-test/components/WebhookTest.tsx` | Teste de webhook |
| `src/pages/admin/meta-test/components/EventLog.tsx` | Log de eventos em tempo real |
| `supabase/functions/meta-auth/index.ts` | Edge Function para trocar code por token |
| `supabase/functions/meta-webhook/index.ts` | Edge Function para receber webhooks |
| `supabase/functions/meta-send-test/index.ts` | Edge Function para testar envio |

## Detalhamento Tecnico

### 1. Pagina Principal (MetaTestPage.tsx)

```typescript
// Estados principais
const [appId, setAppId] = useState('');
const [configId, setConfigId] = useState('');
const [sdkLoaded, setSdkLoaded] = useState(false);
const [events, setEvents] = useState<EventLog[]>([]);
const [signupData, setSignupData] = useState<SignupData | null>(null);
const [accessToken, setAccessToken] = useState<string | null>(null);

// Fluxo de teste em 5 etapas
// Cada etapa so habilita apos a anterior ser concluida com sucesso
```

### 2. Carregador do SDK (MetaSdkLoader.tsx)

```typescript
// Carrega o Facebook SDK dinamicamente
// Inicializa com o App ID informado
// Mostra status: carregando, carregado, erro

useEffect(() => {
  const script = document.createElement('script');
  script.src = 'https://connect.facebook.net/en_US/sdk.js';
  script.onload = () => {
    window.FB.init({
      appId: appId,
      cookie: true,
      xfbml: true,
      version: 'v21.0'
    });
    setSdkLoaded(true);
  };
  document.body.appendChild(script);
}, [appId]);
```

### 3. Teste do Embedded Signup (EmbeddedSignupTest.tsx)

```typescript
// Inicia o fluxo de signup
// Captura todos os eventos via postMessage
// Mostra log em tempo real
// Extrai waba_id, phone_number_id e code

const handleLaunchSignup = () => {
  window.FB.login((response) => {
    if (response.authResponse) {
      addEvent('LOGIN_SUCCESS', { code: response.authResponse.code });
      setSignupData(prev => ({ ...prev, code: response.authResponse.code }));
    }
  }, {
    config_id: configId,
    response_type: 'code',
    override_default_response_type: true,
    extras: {
      sessionInfoVersion: 2,
      feature: 'whatsapp_embedded_signup'
    }
  });
};
```

### 4. Edge Function meta-auth

```typescript
// Recebe: code, app_id, app_secret (via secrets)
// Troca code por access_token
// Retorna: access_token, token_type, expires_in

const tokenResponse = await fetch(
  `https://graph.facebook.com/v21.0/oauth/access_token?` +
  `client_id=${META_APP_ID}&` +
  `client_secret=${META_APP_SECRET}&` +
  `code=${code}`
);

// Retorna token para a pagina de teste validar
```

### 5. Edge Function meta-webhook (modo teste)

```typescript
// GET: Responde challenge de verificacao
// POST: Loga mensagens recebidas em tabela temporaria

// Tabela temporaria para testes
CREATE TABLE meta_webhook_logs (
  id SERIAL PRIMARY KEY,
  payload JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 6. Teste de Envio de Mensagem

```typescript
// Usa o access_token obtido
// Permite enviar mensagem de teste para numero informado
// Mostra resposta da API (sucesso/erro)

const sendTestMessage = async () => {
  const response = await supabase.functions.invoke('meta-send-test', {
    body: {
      accessToken,
      phoneNumberId: signupData.phone_number_id,
      to: testPhoneNumber,
      message: testMessage
    }
  });
};
```

## Secrets Necessarios

Precisamos adicionar os seguintes secrets:

| Secret | Descricao | Onde Obter |
|--------|-----------|------------|
| `META_APP_ID` | ID do App aprovado | developers.facebook.com > Seu App > Configuracoes |
| `META_APP_SECRET` | Secret do App | developers.facebook.com > Seu App > Configuracoes |

## Rota Protegida

A pagina sera acessivel apenas por admins em `/admin/meta-test`:

```typescript
// Em App.tsx, dentro de AdminRoute
<Route path="/admin/meta-test" element={<MetaTestPage />} />
```

## Variaveis de Ambiente Frontend

Adicionar ao `.env` (serao preenchidas na UI de teste):

```env
# Nao necessario - usuario informa na pagina de teste
# VITE_META_APP_ID e VITE_META_CONFIG_ID serao inputs na pagina
```

## Beneficios da Pagina de Teste

1. **Validacao completa** - Testar cada etapa do fluxo isoladamente
2. **Debug facilitado** - Log de eventos em tempo real
3. **Sem afetar producao** - Nenhuma alteracao no fluxo existente dos agentes
4. **Documentacao viva** - Serve como referencia de implementacao
5. **Teste de webhook** - Validar que mensagens estao sendo recebidas

## Proximos Passos Apos Criar Pagina de Teste

1. Testar fluxo completo do Embedded Signup
2. Validar troca de token
3. Testar envio de mensagem
4. Testar recepcao de webhook
5. Validar que tudo funciona antes de integrar nos agentes

