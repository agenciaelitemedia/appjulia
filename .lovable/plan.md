
## Plano: corrigir de vez o item da lista no Atendimento Humano

### Problema real no layout atual
O item está tentando encaixar **nome, horário, telefone e badge** em pouco espaço horizontal. Isso faz o horário sumir e o badge competir com o telefone. Para ficar como WhatsApp e manter legibilidade, o layout precisa mudar de estrutura, não só de espaçamento.

### O que vou ajustar

#### 1. `InactiveLeadItem.tsx` — reestruturar o card em 3 áreas
Vou trocar o layout atual por uma composição mais estável:

```text
[ avatar ] [ nome                 ] [ hora ]
          [ badge da fase         ]
          [ telefone              ]
```

#### 2. Horário igual ao comportamento visual do WhatsApp
- deixar o horário em uma **coluna fixa à direita**
- usar `text-right`, `whitespace-nowrap`, `shrink-0`
- reservar largura para ele (`min-w`/`w-fit` com largura mínima)
- manter a formatação:
  - hoje: `14:35`
  - ontem: `Ontem`
  - últimos dias: dia da semana curto
  - mais antigos: data

Isso evita o nome empurrar o horário para fora.

#### 3. Badge abaixo do nome
- mover `stage_name` para a linha logo abaixo do nome
- deixar o badge sempre visível com `inline-flex w-fit max-w-full`
- adicionar fallback visual quando `stage_color` vier vazio
- impedir que o badge dispute espaço com o horário

#### 4. Telefone em linha separada
- telefone fica sozinho na terceira linha
- `text-xs truncate text-muted-foreground`
- isso melhora leitura e evita quebra visual

#### 5. Ajustar densidade do item
- reduzir ligeiramente gaps e paddings internos
- manter avatar compacto
- preservar borda lateral de seleção
- suavizar separador inferior para ficar mais próximo de uma lista de conversa

#### 6. `HumanSupportPage.tsx` — ajustar largura da lateral
A lateral já foi ampliada antes, mas o padrão Helena/WhatsApp funciona melhor com mais respiro. Vou alinhar a sidebar para a largura do padrão de chat (`w-96 / min-w-96`) para o item caber sem gambiarra.

### Arquivos a alterar
- `src/pages/atendimento-humano/components/InactiveLeadItem.tsx`
- `src/pages/atendimento-humano/HumanSupportPage.tsx`

### Resultado esperado
- horário sempre visível no canto superior direito
- badge da fase imediatamente abaixo do nome
- telefone legível sem disputar espaço
- item visualmente parecido com lista de conversas do WhatsApp
- sidebar com largura suficiente para não “quebrar” os elementos
