
# Plano: Customização Visual do CRM Builder (Estilo CRM Julia)

## Objetivo
Aplicar ao CRM Builder o mesmo visual do CRM da Julia, incluindo:
1. Barra de rolagem horizontal customizada (draggable)
2. Estilo visual das etapas (colunas do pipeline)
3. Estilo visual dos cards (deals)

---

## Comparativo Atual

### CRM Julia (Referência)
- **Scroll**: Barra customizada com thumb arrastável no rodapé (`CRMScrollNavigation`)
- **Colunas**: `min-w-[280px]`, `bg-muted/30`, header com cor 20% opacidade, círculo colorido + badge de contagem
- **Cards**: Borda esquerda colorida (`border-l-4`), botões de ação no header, datas formatadas com timezone

### CRM Builder (Atual)
- **Scroll**: Overflow nativo do navegador
- **Colunas**: `w-80` (320px), `rounded-xl border`, header com `border-bottom`
- **Cards**: Sem borda lateral colorida, menos botões de ação

---

## Alterações Planejadas

### 1. Barra de Rolagem Customizada

**Arquivo**: `src/pages/crm-builder/BoardPage.tsx`

Adicionar o componente `CRMScrollNavigation` (já existente no CRM Julia) ao CRM Builder:

- Criar uma referência (`scrollRef`) para o container de pipelines
- Ocultar a scrollbar nativa com `scrollbar-none` e estilos inline
- Renderizar `CRMScrollNavigation` abaixo do container de pipelines

```text
Antes:
<div className="flex-1 overflow-x-auto p-4">
  ...pipelines...
</div>

Depois:
<div className="flex flex-col flex-1">
  <div ref={scrollRef} className="flex-1 overflow-x-auto scrollbar-none p-4">
    ...pipelines...
  </div>
  <CRMScrollNavigation scrollRef={scrollRef} />
</div>
```

### 2. Visual das Etapas (PipelineColumn)

**Arquivo**: `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx`

Aplicar o estilo visual do CRM Julia:

| Elemento | Atual | Novo (Estilo Julia) |
|----------|-------|---------------------|
| Largura | `w-80` (320px) | `min-w-[280px] max-w-[280px]` |
| Container | `rounded-xl border` | `rounded-lg` (sem borda externa) |
| Header | `border-b` na parte inferior | `backgroundColor: ${color}20` (fundo colorido 20%) |
| Área de Cards | `overflow-y-auto max-h-[...]` | Sem scroll interno (página rola) |
| Botão Adicionar | Fixo no rodapé | Integrado no final da lista de cards |

**Mudanças específicas**:
- Remover `border` da coluna
- Header com `rounded-t-lg` e fundo usando a cor da etapa
- Remover o scroll vertical interno (os cards rolam com a página)
- Remover `border-t` do botão de adicionar e integrar no fluxo

### 3. Visual dos Cards (DealCard)

**Arquivo**: `src/pages/crm-builder/components/deals/DealCard.tsx`

Aplicar a borda lateral colorida e ajustar layout:

| Elemento | Atual | Novo (Estilo Julia) |
|----------|-------|---------------------|
| Borda | Sem borda lateral | `border-l-4` com cor do pipeline |
| Ícone Contato | Ícone User cinza | Emoji 👤 + cor primary |
| Ações | Menu dropdown (hover) | Botões visíveis + menu dropdown |
| Footer | Priority + Tags + Time | Datas + Tempo na fase (layout mais detalhado) |

**Nova estrutura do card**:
```text
┌─────────────────────────────────┐
│ 👤 Título/Contato      [⋮] Menu │  <- Header com ações
├─────────────────────────────────┤
│ 💰 R$ 1.500                     │  <- Valor (se existir)
├─────────────────────────────────┤
│ 📞 Telefone                     │  <- Info contato
│ ✉️ Email                        │
├─────────────────────────────────┤
│ Criado: 01/01/2026 10:00        │  <- Datas
│ Atualizado: 02/01/2026 15:30    │
│ 🕐 Na fase: 2 dias              │  <- Tempo na fase
│           🇧🇷 Horário de Brasília │
└─────────────────────────────────┘
```

**Nota**: O DealCard precisa receber a cor do pipeline como prop para aplicar a `border-l-4`.

---

## Fluxo de Dados para Cor do Pipeline

Atualmente o `DealCard` não tem acesso à cor do pipeline. Precisamos passar essa informação:

```text
BoardPage
    └── PipelineColumn (tem pipeline.color)
            └── DealCard (precisa de pipelineColor)
```

**Solução**: Passar `pipelineColor` como prop para o `DealCard`.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm-builder/BoardPage.tsx` | Adicionar scrollRef e CRMScrollNavigation |
| `src/pages/crm-builder/components/pipeline/PipelineColumn.tsx` | Aplicar estilo visual das colunas do CRM Julia |
| `src/pages/crm-builder/components/deals/DealCard.tsx` | Adicionar border-l-4, layout de datas, prop pipelineColor |

---

## Detalhamento Técnico

### BoardPage.tsx
1. Importar `CRMScrollNavigation` de `'@/pages/crm/components/CRMScrollNavigation'`
2. Criar `useRef<HTMLDivElement>(null)` para o container
3. Adicionar estilos para ocultar scrollbar nativa
4. Renderizar `CRMScrollNavigation` após o container de pipelines

### PipelineColumn.tsx
1. Alterar classes do container:
   - De: `w-80 flex-shrink-0 ... rounded-xl border`
   - Para: `min-w-[280px] max-w-[280px] flex-shrink-0 bg-muted/30 rounded-lg`
2. Header com `backgroundColor: ${pipeline.color}20` e `rounded-t-lg`
3. Remover `overflow-y-auto` e `max-h-[...]` do container de cards
4. Passar `pipelineColor` para cada DealCard

### DealCard.tsx
1. Adicionar prop `pipelineColor?: string`
2. Aplicar `border-l-4` com `borderLeftColor: pipelineColor`
3. Adicionar seção de datas formatadas (Criado/Atualizado)
4. Manter o indicador de "tempo na fase"
5. Adicionar indicador de timezone (🇧🇷 Horário de Brasília)

---

## Resultado Esperado

Após as alterações:
- A navegação horizontal terá uma barra customizada arrastável (igual ao CRM Julia)
- As colunas de pipeline terão o mesmo estilo visual com header colorido
- Os cards terão borda lateral colorida e exibirão datas detalhadas
- A experiência visual será consistente entre os dois módulos de CRM
