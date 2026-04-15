

## Plano: Modo Express (`t=express`) e persistência do contrato

### O que será feito

**1. Modo Express no fluxo de compra**

Quando a URL contiver `t=express`, o fluxo terá apenas 3 etapas visíveis: **Documento → Dados → Pagamento**. O plano será selecionado automaticamente (primeiro plano disponível com base no parâmetro `c`) e o contrato será aceito implicitamente (gerado em background e salvo no pedido).

**2. Persistência do contrato no pedido**

Em ambos os modos (normal e express), o contrato renderizado (Markdown com placeholders substituídos) será salvo na tabela `julia_orders` em uma nova coluna `contract_body`.

---

### Alterações

**Migração SQL** — adicionar coluna `contract_body` na tabela `julia_orders`:
```sql
ALTER TABLE julia_orders ADD COLUMN contract_body text;
```

**`ComprarPage.tsx`**:
- Ler parâmetro `t` da URL; se `t=express`, ativar modo express
- Definir steps dinâmicos: express = `['Documento', 'Dados', 'Pagamento']`, normal = os 5 atuais
- Adicionar `contract_body` ao `OrderData`
- Mapear step index para o componente correto baseado no modo
- No modo express, após CustomerStep (step 1), auto-selecionar primeiro plano disponível e gerar contrato em background antes de ir para pagamento

**`ContractStep.tsx`**:
- Exportar função utilitária `generateContractBody(orderData)` que busca o template e substitui placeholders
- O componente continua usando essa função internamente
- Ao clicar "Continuar", salvar `contractBody` no orderData via `updateOrder({ contract_body: contractBody })`
- Atualizar props para receber `updateOrder`

**`CheckoutStep.tsx`**:
- No `handlePay`, incluir `contract_body` no update do pedido:
```ts
await supabase.from('julia_orders').update({
  ...campos existentes,
  contract_body: orderData.contract_body,
}).eq('id', orderData.id);
```

**`PlanStep.tsx`** — sem alterações diretas; no modo express, o ComprarPage auto-seleciona o plano.

### Fluxo Express detalhado
1. Usuário acessa `/comprar?c=vendedora&p=mp&t=express`
2. Vê apenas 3 etapas: Documento → Dados → Pagamento
3. Após preencher dados (step 1), ao clicar "Continuar":
   - Plano é selecionado automaticamente (primeiro disponível para o canal)
   - Contrato é gerado em background com os dados preenchidos
   - `contract_body` é salvo no orderData
   - Avança direto para Pagamento (step 2)
4. No pagamento, `contract_body` é persistido junto com o pedido

### Fluxo Normal (sem alteração comportamental)
- Continua com 5 etapas
- A única mudança: ContractStep agora salva o `contract_body` no orderData
- CheckoutStep persiste o contrato no banco junto com o pedido

