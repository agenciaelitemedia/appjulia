## Diagnóstico da causa

O `CreateDealDialog` envolve todo o conteúdo em `<form onSubmit={handleSubmit}>`. Dentro dele, o `ContactPicker` renderiza vários `<Button>` **sem `type="button"` explícito**.

No HTML, o tipo default de `<button>` dentro de um `<form>` é `submit`. Portanto, ao clicar em "Salvar contato" no formulário de novo contato, dispara-se simultaneamente:
1. `handleSave` do ContactPicker (cria o contato em `chat_contacts`)
2. `handleSubmit` do form pai (cria o card no `crm_deals`)

É exatamente o sintoma relatado: "ele já salva e cria o lead antes de cadastrar".

## Botões afetados em `ContactPicker.tsx`

| Linha | Botão | Problema |
|---|---|---|
| 159 | "Trocar" (limpa seleção) | submete o form |
| 173 | "Voltar" (sai do modo create) | submete |
| 242 | "Usar" (seleciona duplicado) | submete |
| 254 | "Cancelar" (no modo create) | submete |
| **255** | **"Salvar contato"** | **submete + salva → cria card prematuramente** ⚠️ |
| 277 | `<button>` nativo (X de limpar busca) | submete |
| 286 | "Novo Contato" | ✅ já tem `type="button"` |

## Correção

Adicionar `type="button"` em todos os botões internos do `ContactPicker` que não devem submeter o form pai. Mudança trivial e sem risco para o restante do fluxo.

**Arquivo a editar:**
- `src/pages/crm-builder/components/deals/ContactPicker.tsx` — adicionar `type="button"` nos botões das linhas 159, 173, 242, 254, 255 e 277.

## Validação após correção

1. Abrir CreateDealDialog → clicar "Novo Contato" → preencher → clicar "Salvar contato": deve apenas cadastrar o contato e voltar para o modo de seleção (sem fechar o dialog nem criar o card).
2. O card só deve ser criado ao clicar explicitamente em "Criar" no rodapé do dialog.
3. Botões "Trocar", "Voltar", "Cancelar", "Usar" e o "X" da busca não devem mais disparar a criação do card.