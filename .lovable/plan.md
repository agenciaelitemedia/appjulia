# Reorganizar barra superior do JulIA Chat — nova conversa e limpar filtros

## Objetivo
Reduzir ainda mais a barra superior do `/chat` e retirar o rodapé fixo de "Iniciar nova conversa", movendo-o para um painel expansível no topo.

```text
[ Campo de busca ] [ ícone Filtros ] [ ícone ⊕ (nova conversa) ] [ ícone ⋮ ]
```

## Mudanças

### 1. Barra superior (`src/modules/julia-chat/components/JuliaChatFilters.tsx`)
- Remover o ícone "Limpar filtros" (`RotateCcw`) da linha principal.
- Adicionar ícone "Nova conversa" (`MessageSquarePlus`, semelhante à imagem enviada) ao lado do ícone de filtros.
- O ícone de filtros continua acionando o painel de filtros avançados.
- O ícone de nova conversa aciona um novo painel expansível com o formulário de iniciar conversa.
- O menu ⋮ passa a conter também a ação **"Limpar filtros"**.

### 2. Painel de nova conversa
- Criar painel expansível abaixo da barra superior (mesmo comportamento do painel de filtros).
- Reutilizar o formulário existente: seletor de DDI, input de telefone formatado e botão "Conversar".
- Manter a regra de filtrar apenas filas `uazapi` conectadas para o `NewConversationDialog`.
- Preservar estado local de país/telefone e abertura do diálogo de confirmação.

### 3. Remoção do rodapé
- Remover `JuliaNewConversationFooter` de `src/modules/julia-chat/pages/JuliaChatPage.tsx`.
- A lista de conversas passa a ocupar o espaço total disponível, sem o rodapé fixo.

### 4. Estados e comportamentos preservados
- Filtros, busca, ordenação, agenda de retornos, grupos, métricas e configurações.
- Lógica de filas conectadas no novo `NewConversationDialog`.
- Acessibilidade: labels, tooltips e aria-expanded nos novos ícones.

## Critérios de aceitação
- A barra superior exibe apenas: campo de busca, ícone de filtros, ícone de nova conversa e ícone ⋮.
- O menu ⋮ contém: ordenar, limpar filtros, agenda de retornos, grupos (se permitido), métricas e configurações (se permitido).
- O painel de filtros continua funcionando com todos os filtros atuais.
- O painel de nova conversa expande ao clicar no ícone e contém o mesmo formulário do rodapé.
- O rodapé "Iniciar nova conversa" é removido da lista.
- Build sem erros.
