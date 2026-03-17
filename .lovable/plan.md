

## Plano: Substituir "🇧🇷 Horário de Brasília" por ícone de status do agente

### O que muda

No `CRMLeadCard.tsx`, substituir o texto estático "🇧🇷 Horário de Brasília" por um botão com ícone `Bot` que:
- Mostra verde (ativo) ou vermelho (inativo) baseado no status da sessão do lead
- Ao clicar, abre o `SessionStatusDialog` existente

### Implementação

#### 1. `CRMLeadCard.tsx`
- Adicionar estado `sessionOpen` para controlar o `SessionStatusDialog`
- Adicionar estado `isAgentActive` (null = carregando, boolean = status) com fetch via `externalDb.getSessionStatus` no mount
- Substituir o `<span>🇧🇷 Horário de Brasília</span>` (linha 265-267) por um botão clicável com ícone `Bot`:
  - Verde pulsante se ativo, vermelho se inativo, cinza se carregando
  - Tooltip "Julia Ativa" / "Julia Inativa"
  - onClick abre `SessionStatusDialog`
- Adicionar `<SessionStatusDialog>` ao final do componente, passando `whatsappNumber` e `codAgent`
- Ao fechar o dialog, re-fetch o status para sincronizar o ícone

#### Consideração de performance
Como cada card faria uma chamada individual ao backend para buscar o status, isso pode ser pesado com muitos leads. Uma alternativa seria:
- **Opção A**: Fetch individual por card (simples, mas N requests)
- **Opção B**: Passar o status como prop do pipeline (batch fetch no nível do CRMPipeline)

Vou implementar com **Opção A** (fetch no card) com lazy loading — o status só é buscado quando o card é visível, e com cache via `cod_agent` para evitar refetch duplicado para o mesmo agente.

### Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `src/pages/crm/components/CRMLeadCard.tsx` | Substituir texto por ícone Bot + abrir SessionStatusDialog |

