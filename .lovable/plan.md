
# Plano: Melhoria da UI/UX do Componente de Filtros Unificado

## Visão Geral

Vamos aprimorar o componente `UnifiedFilters` para ter uma aparência mais elegante e moderna, utilizando:
- Bordas refinadas e sombras suaves
- Melhor hierarquia visual entre seções
- Transições e efeitos hover mais suaves
- Design mais limpo e organizado

## Alterações Visuais Planejadas

### 1. Container Principal
- Adicionar borda elegante com `border-border`
- Sombra suave com `shadow-sm` ou `shadow-md`
- Background com `bg-card` para melhor contraste
- Cantos arredondados com `rounded-xl`

### 2. Header do Collapsible
- Background sutil no header `bg-muted/50`
- Padding consistente
- Separador visual entre header e conteúdo
- Badge de contagem com estilo mais refinado

### 3. Seção de Períodos Rápidos
- Fundo sutil para agrupar os botões
- Botões com hover states mais elegantes
- Separação visual clara da próxima seção

### 4. Seção de Filtros Detalhados
- Cards individuais para cada grupo de filtro
- Labels com tipografia mais elegante
- Inputs com foco visual aprimorado
- Espaçamento consistente entre elementos

### 5. Melhorias Gerais
- Transições CSS suaves em hover/focus
- Ícones com cores mais harmoniosas
- Botão "Limpar" com estilo mais discreto
- Responsividade mantida

## Arquivo a ser Modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/filters/UnifiedFilters.tsx` | Redesign completo da UI com bordas, sombras e melhor hierarquia visual |

## Estrutura Visual Proposta

```text
+----------------------------------------------------------+
|  [v] Filtros                              [3 agentes]     |  <- Header com bg sutil
+----------------------------------------------------------+
|                                                           |
|  Período Rápido:                                          |
|  +------+ +------+ +------+ +------+ +------+ +------+   |
|  | Hoje | |Ontem | | 7d   | |Semana| | 30d  | | Mês  |   |  <- Botões em pill style
|  +------+ +------+ +------+ +------+ +------+ +------+   |
|                                                           |
+----------------------------------------------------------+
|                                                           |
|  +---------------+  +---------------+  +---------------+ |
|  | Agentes    v  |  | De 📅         |  | Até 📅        | |  <- Inputs com cards
|  +---------------+  +---------------+  +---------------+ |
|                                                           |
|  +-----------------+  +----------------------------+      |
|  | Perfil      v  |  | 🔍 Buscar...               |      |
|  +-----------------+  +----------------------------+      |
|                                                           |
|                                           [Limpar tudo]   |
+----------------------------------------------------------+
```

## Detalhes de Implementação

### Classes CSS a utilizar:
- **Container**: `bg-card border border-border rounded-xl shadow-sm`
- **Header**: `bg-muted/40 px-4 py-3 rounded-t-xl border-b`
- **Seção Períodos**: `px-4 py-3 border-b border-border/50`
- **Seção Filtros**: `px-4 py-4`
- **Botões Quick Period**: `rounded-full hover:shadow-sm transition-all`
- **Inputs/Selects**: `bg-background hover:border-primary/50 transition-colors`
- **Botão Limpar**: `text-muted-foreground hover:text-foreground`

### Transições:
```css
transition-all duration-200 ease-in-out
```

### Hover States:
- Botões: `hover:shadow-sm hover:scale-[1.02]`
- Inputs: `focus:ring-2 focus:ring-primary/20`

## Resultado Esperado

O componente terá uma aparência mais:
- **Profissional**: Sombras e bordas refinadas
- **Organizada**: Seções claramente separadas
- **Elegante**: Transições suaves e cores harmoniosas
- **Moderna**: Seguindo tendências de design de dashboard

O design manterá todas as funcionalidades existentes, apenas melhorando a apresentação visual.
