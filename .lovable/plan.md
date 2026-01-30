
# Correção: Captura do phone_number_id no Embedded Signup

## Problema Identificado

A Etapa 4 está desabilitada porque o `phone_number_id` não está sendo capturado corretamente durante o fluxo de signup.

### Causa Raiz

No arquivo `EmbeddedSignupTest.tsx`, existe um problema de **closure/timing** no React:

```text
Fluxo Atual (com bug):
1. Usuário completa signup
2. Evento FINISH chega → setSignupData({ waba_id, phone_number_id })
3. React agenda atualização do estado (ainda não executou)
4. FB.login callback executa → usa signupData que ainda é NULL
5. onSignupComplete({ ...null, code }) → perde waba_id e phone_number_id
```

Na linha 78-83, o código faz:
```typescript
const finalData: SignupData = {
  ...signupData,  // ← signupData ainda é null aqui!
  code: response.authResponse.code,
};
```

## Solução

Usar uma **ref** para armazenar os dados do signup em tempo real, garantindo que o callback do `FB.login` sempre tenha acesso aos dados mais recentes.

### Mudanças no EmbeddedSignupTest.tsx

```typescript
// Adicionar useRef
import { useState, useRef } from 'react';

// Criar ref para dados do signup
const signupDataRef = useRef<SignupData | null>(null);

// No evento FINISH, atualizar tanto state quanto ref
if (data.event === 'FINISH') {
  const newData: SignupData = {
    waba_id: data.data?.waba_id,
    phone_number_id: data.data?.phone_number_id,
  };
  signupDataRef.current = { ...signupDataRef.current, ...newData };
  setSignupData((prev) => ({ ...prev, ...newData }));
}

// No callback do FB.login, usar a ref
if (response.authResponse?.code) {
  const finalData: SignupData = {
    ...signupDataRef.current,  // ← Agora usa a ref (sempre atualizada)
    code: response.authResponse.code,
  };
  signupDataRef.current = finalData;
  setSignupData(finalData);
  onSignupComplete(finalData);
}
```

## Resultado Esperado

```text
Fluxo Corrigido:
1. Usuário completa signup
2. Evento FINISH chega → signupDataRef.current = { waba_id, phone_number_id }
3. FB.login callback executa → usa signupDataRef.current (tem os dados!)
4. onSignupComplete({ waba_id, phone_number_id, code }) → completo!
5. Etapa 4 fica habilitada porque tem phone_number_id
```

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/admin/meta-test/components/EmbeddedSignupTest.tsx` | Adicionar useRef e corrigir lógica de captura |

## Por que isso resolve

- `useRef` não dispara re-render e o valor é atualizado **imediatamente**
- O callback do `FB.login` sempre terá acesso ao valor mais recente via `signupDataRef.current`
- Mantemos o `useState` para atualizar a UI normalmente
