

## Plano: Ajustar Layout da Lista de Conversas — Atendimento Humano

### Problemas Identificados

Comparando o `InactiveLeadItem` com o `ChatContactItem` (estilo Helena usado no chat do CRM), existem diferenças de layout que prejudicam a visualização:

1. **Alinhamento vertical** — usa `items-center` no container principal, comprimindo o conteúdo quando há múltiplas linhas
2. **Espaçamento entre linhas** — `space-y-1` é muito apertado para separar nome/tempo da linha de telefone/badge
3. **Indicador de seleção** — `border-l-2` é fino demais; o estilo Helena usa `border-l-3`
4. **Falta de preview da última mensagem** — diferente do chat Helena, não mostra um resumo da última mensagem
5. **Badge de urgência não está destacado** — o tempo com urgência alta deveria ter um fundo sutil para chamar mais atenção

### Mudanças

#### `InactiveLeadItem.tsx` — Refatorar layout para estilo Helena

- Trocar `items-center` por `items-start` no container principal (avatar alinhado ao topo)
- Aumentar `border-l-2` para `border-l-3` (consistente com Helena)
- Usar `space-y-0.5` para espaçamento mais natural entre as 3 linhas
- Reorganizar em 3 linhas claras:
  - **Linha 1**: Nome (truncado) + tempo com ícone Clock (alinhado à direita)
  - **Linha 2**: Telefone formatado + badge de stage do CRM
  - **Linha 3** (opcional): Preview da última mensagem se disponível no `InactiveSession`
- Adicionar padding horizontal `px-4` (igual ao Helena, atual é `px-3`)
- Adicionar fundo sutil no badge de tempo quando urgência é alta (`bg-red-50 rounded px-1`)

#### Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `src/pages/atendimento-humano/components/InactiveLeadItem.tsx` | Refatorar layout para 3 linhas estilo Helena com melhor visibilidade do tempo |

