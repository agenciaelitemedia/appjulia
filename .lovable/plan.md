

## Plano: Redesenhar Lista de Chats no Estilo Helena

### Referência Visual (Helena)

A Helena usa um layout compacto com:
- **Tabs no topo** como pills horizontais: "Novos 6", "Meus 3", "Outros 8" com contadores coloridos
- **Barra de busca** logo abaixo com ícones de filtro/ordenação
- **Seções agrupadas** com labels como "Atendimento distribuído para Amanda"
- **Cada item**: avatar circular com iniciais + ícone do canal (WhatsApp verde) sobreposto, nome em negrito, badges coloridos (SUPORTE, PRIORIDADE, LEAD WHITE LABEL), nome da fila à direita (ex: "Atendimento Geral"), tempo relativo ("há poucos segundos", "há 15 minutos"), preview da última mensagem, e badge de unread vermelho circular
- **Sem bordas/cards** — items separados apenas por espaço, fundo limpo

### O que manter

- Seletor de filas (Select dropdown)
- Tabs Individual / Grupos
- Filtros de status (Todas, Pendentes, Abertas, Resolvidas)

### Mudanças

#### 1. `ChatList.tsx` — Reorganizar header

- Mover os **tabs de status** (Novos/Pendentes, Meus/Abertos, Outros/Resolvidos) para o **topo** como pills estilo Helena com contadores em badges coloridos
- Mover a **busca** logo abaixo dos tabs com ícones de filtro e ordenação à direita
- Mover o **seletor de filas** abaixo da busca
- Remover os channel filters (row de botões WA/WABA/Web/IG) — simplificar
- Remover os tabs "Todas/Individual/Grupos" como TabsList e converter para um toggle mais sutil dentro dos filtros

#### 2. `ChatContactItem.tsx` — Redesenhar item

Layout Helena:
```text
┌──────────────────────────────────────────────┐
│ [AV]  Nome do Contato        Fila Name       │
│  🟢   [BADGE1] [BADGE2]     há 15 min  (3)  │
│       Preview da mensagem...                  │
└──────────────────────────────────────────────┘
```

- Avatar com **ícone do canal** sobreposto no canto inferior esquerdo (pequeno círculo verde WhatsApp)
- **Nome** em negrito à esquerda, **nome da fila** alinhado à direita em texto cinza
- **Badges coloridos** abaixo do nome (tags do conversation como status, prioridade) — pequenos, arredondados, coloridos (verde, vermelho, azul)
- **Tempo** no canto superior direito em formato relativo ("há X min", "há X horas")
- **Unread badge** como círculo vermelho com número, alinhado à direita
- **Preview** da última mensagem na terceira linha, com ícones de mídia
- Remover o rounded-lg do hover — usar borda esquerda colorida no item selecionado (borda azul/roxa como Helena)
- Fundo mais limpo, sem cards

#### 3. `ChatContainer.tsx` — Ajustar largura

- Aumentar sidebar de `w-80` para `w-96` (384px) para acomodar o layout mais rico

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/chat/ChatList.tsx` | Reorganizar header: tabs como pills no topo, busca abaixo, remover channel filters |
| `src/components/chat/ChatContactItem.tsx` | Redesenhar no estilo Helena: badges, canal overlay, fila à direita, borda seleção |
| `src/components/chat/ChatContainer.tsx` | Aumentar largura do sidebar para w-96 |

