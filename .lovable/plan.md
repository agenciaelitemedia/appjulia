

# Auto-criar card no CRM Comercial a partir do webhook Vellip

## Resumo

Quando o webhook Vellip receber um registro com `cd_resp1 == "1"`, além de gravar na `vellip_call_logs`, criará automaticamente um card na etapa "Interessados" do CRM Comercial.

## Alteração

### `supabase/functions/vellip-webhook/index.ts`

Após o insert bem-sucedido em `vellip_call_logs`, adicionar lógica:

1. Converter `cd_resp1` para string e comparar com `"1"`
2. Se igual, buscar o `stage_id` da etapa "Interessados" em `crm_comercial_stages` (position = 1)
3. Inserir card em `crm_comercial_cards`:
   - `contact_name`: valor de `phone` (telefone)
   - `contact_phone`: valor de `phone`
   - `cod_agent`: valor do query param
   - `stage_id`: id da etapa "Interessados"
   - `notes`: `"Vindo de campanha da Vellip"`
4. Inserir histórico em `crm_comercial_history`:
   - `to_stage_id`: id da etapa "Interessados"
   - `notes`: `"Card criado via webhook Vellip"`

Trecho adicionado após linha 66 (após log de sucesso):

```typescript
// Auto-create CRM card if cd_resp1 == "1"
const resp1 = String(body.cd_resp1 ?? '')
if (resp1 === '1') {
  const { data: stage } = await supabase
    .from('crm_comercial_stages')
    .select('id')
    .eq('name', 'Interessados')
    .single()

  if (stage) {
    const { data: card } = await supabase
      .from('crm_comercial_cards')
      .insert({
        stage_id: stage.id,
        contact_name: dest,
        contact_phone: dest,
        cod_agent,
        notes: 'Vindo de campanha da Vellip',
      })
      .select('id')
      .single()

    if (card) {
      await supabase.from('crm_comercial_history').insert({
        card_id: card.id,
        to_stage_id: stage.id,
        notes: 'Card criado via webhook Vellip',
      })
    }
    console.log('[vellip-webhook] CRM card created for', dest)
  }
}
```

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/vellip-webhook/index.ts` | Adicionar criação automática de card no CRM quando cd_resp1 == "1" |

