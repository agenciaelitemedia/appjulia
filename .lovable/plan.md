

# Ativar API de Coexistencia da Meta no Embedded Signup

## Problema

O codigo atual usa o fluxo padrao de Embedded Signup (`feature: 'whatsapp_embedded_signup'`), que **desconecta** o numero do WhatsApp Business App ao migrar para a Cloud API.

A API de Coexistencia usa um parametro diferente: `featureType: 'whatsapp_business_app_onboarding'`, que permite manter o app ativo no mesmo numero.

## Alteracao

| Arquivo | Acao |
|---|---|
| `src/pages/agente/meus-agentes/components/WabaSetupDialog.tsx` | Trocar `feature: 'whatsapp_embedded_signup'` por `featureType: 'whatsapp_business_app_onboarding'` no objeto `extras` do `FB.login()` |
| `src/pages/admin/meta-test/components/EmbeddedSignupTest.tsx` | Mesma troca no componente de teste admin |

## Detalhe tecnico

Linha 117 do WabaSetupDialog:
```js
// DE (Cloud API padrao):
extras: { sessionInfoVersion: 3, feature: 'whatsapp_embedded_signup' }

// PARA (Coexistencia):
extras: { sessionInfoVersion: 3, featureType: 'whatsapp_business_app_onboarding' }
```

Linha ~96 do EmbeddedSignupTest:
```js
// DE:
extras: { sessionInfoVersion: 2, feature: 'whatsapp_embedded_signup' }

// PARA:
extras: { sessionInfoVersion: 3, featureType: 'whatsapp_business_app_onboarding' }
```

## Prerequisitos Meta

- O app Meta (848563184591665) precisa ter o produto WhatsApp configurado com suporte a Coexistence
- O Config ID (1210464914261747) precisa estar habilitado para coexistencia no painel do Meta Developers
- Numeros precisam ter 7+ dias de uso ativo no WhatsApp Business App

## Impacto

Apenas 2 linhas alteradas. O restante do fluxo (token exchange, save credentials, verify) permanece identico.

