

# Checkout Integrado na Tela — Cartão + Pix com InfinityPay

## Resumo

Substituir o iframe/redirect do CheckoutStep por uma tela de pagamento completa integrada na própria página, baseada no componente JSX fornecido. Inclui: seleção Cartão/Pix, preview interativo do cartão com detecção de bandeira, parcelamento até 12x, QR Code Pix, tela de processamento animada e confirmação de sucesso. O fluxo real continua usando a edge function `infinitypay-checkout` para gerar o link de pagamento.

## Fluxo

```text
CheckoutStep (Step 4)
├── Resumo do pedido (sidebar direita)
├── Método: Cartão de Crédito | Pix (tabs)
│   ├── Cartão: preview animado + form (número, nome, validade, CVV, CPF, parcelas)
│   └── Pix: QR Code placeholder + código copiável + email recibo
├── Botão "Pagar R$ X" → chama edge function → tela processing
└── Tela de sucesso com NSU e detalhes
```

## Implementação

### 1. Reescrever `src/pages/comprar/steps/CheckoutStep.tsx`

Converter o JSX fornecido (inline styles) para Tailwind CSS + componentes shadcn, adaptando ao design da página `/comprar`:

- **Layout**: Duas colunas (form esquerda, resumo direita) com fundo escuro `#0a0f1a` gradiente — similar ao componente fornecido
- **Tabs Cartão/Pix**: Botões com borda verde `#00D26A` quando ativo
- **Card preview**: Div interativa com gradiente baseado na bandeira, flip no CVV
- **Form fields**: Inputs estilizados com foco verde, formatação automática (número do cartão, validade, CPF)
- **Parcelas**: Select com cálculo automático até 12x
- **Pix**: QR Code placeholder + código copia-e-cola + campo email
- **Sidebar**: Resumo do pedido com itens, total, trust badges (SSL, antifraude, recebimento)
- **Botão pagar**: Gradiente verde `#00D26A`, chama a edge function existente
- **Processing**: Spinner + barra de progresso animada
- **Success**: Check icon + NSU + detalhes da transação

### 2. Integração com API

O botão "Pagar" continua chamando `supabase.functions.invoke('infinitypay-checkout')` como hoje. A diferença é que:
- Os dados visuais do cartão ficam apenas no frontend (a InfinityPay processa pelo checkout link)
- Após gerar o checkout_url, abre em nova aba (a API pública não aceita dados de cartão diretamente)
- A tela de processing/success é exibida localmente enquanto aguarda

### 3. Helpers (no mesmo arquivo)

- `formatCardNumber()` — formata com espaços a cada 4 dígitos
- `formatExpiry()` — formata MM/AA
- `cardBrand()` — detecta Visa, Mastercard, Elo, Amex etc.
- `formatCurrency()` — formata centavos para R$

### 4. Ajustar `ComprarPage.tsx`

Quando step === 3 (Pagamento), esconder o header/stepper/footer padrão para dar espaço à tela de checkout full-screen com fundo escuro.

## Arquivos alterados

| Arquivo | Ação |
|---|---|
| `src/pages/comprar/steps/CheckoutStep.tsx` | Reescrever completamente |
| `src/pages/comprar/ComprarPage.tsx` | Condicional para esconder stepper no step 3 |

