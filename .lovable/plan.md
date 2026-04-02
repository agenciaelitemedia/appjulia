

# Correção: InfinityPay recusa iframe — Redirecionar para nova aba

## Problema

O `checkout.infinitepay.io` bloqueia embedding via iframe (headers `X-Frame-Options` ou `Content-Security-Policy`). Por isso o iframe mostra "conexão recusada".

## Solução

Substituir o iframe por um redirecionamento automático para nova aba + tela de "aguardando pagamento" com polling.

### Alterações em `CheckoutStep.tsx`

Quando `checkoutUrl` é obtido:
1. Abrir automaticamente em nova aba via `window.open(checkoutUrl, '_blank')`
2. Em vez do iframe, mostrar uma tela de status com:
   - Mensagem "Aguardando confirmação do pagamento..."
   - Animação de loading
   - Link para reabrir o checkout caso a aba tenha sido bloqueada
   - Botão "Já paguei" (já existe)
3. Manter o polling de 5s que já existe para detectar `status: 'paid'`

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/pages/comprar/steps/CheckoutStep.tsx` | Remover iframe, abrir URL em nova aba, mostrar tela de espera |

