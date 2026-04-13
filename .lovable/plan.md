

## Plano: Ações no Header do Chat — Atendimento Humano

### Objetivo

Adicionar ao header do chat inline (`variant="inline"`) no Atendimento Humano:
1. **Detalhes do Contrato** como sidebar (já existe, funciona no inline)
2. **Ícone de Detalhes do Card** (Eye) — abre o `CRMLeadDetailsDialog` com dados do card do CRM
3. **Ícone de Telefonia** (Phone) — abre o `PhoneCallDialog` para ligar via ramal
4. **Ícone de link para CRM** (ExternalLink) — navega direto para `/crm/leads` filtrando pelo lead

### Mudanças

#### 1. `WhatsAppMessagesDialog.tsx` — Adicionar ícones ao header

Na área de ícones do header (linhas ~1745), adicionar 3 novos botões com tooltip **antes ou após** os ícones existentes (Scale + Bot + Switch):

- **Eye** → abre `CRMLeadDetailsDialog` usando o card obtido por `useCRMCardByWhatsapp` (já importado)
- **Phone** → abre `PhoneCallDialog` (já usado no CRMLeadCard)
- **ExternalLink** → `navigate('/crm/leads?search=WHATSAPP_NUMBER')` para filtrar no CRM

Importar `Eye`, `Phone`, `ExternalLink` do lucide-react. Importar `PhoneCallDialog`, `CRMLeadDetailsDialog`, `useCRMStages` e `useNavigate`.

Adicionar states: `phoneCallOpen`, `detailsOpen`.

Renderizar os dialogs (`PhoneCallDialog`, `CRMLeadDetailsDialog`) junto aos outros dialogs no final do componente (inline e wrapper).

#### 2. Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Adicionar 3 ícones ao header + seus dialogs |

Nenhum outro arquivo precisa ser alterado — o `HumanSupportPage` já renderiza o `WhatsAppMessagesDialog` com `variant="inline"` e as mudanças ficam no componente compartilhado.

