
# Layout do Formulário de Criação de Agentes

## Visão Geral

Criar um formulário de cadastro de agentes em formato wizard (multi-etapas) seguindo o padrão do repositório GitHub `painel-helena`. O formulário será implementado como uma nova página `/admin/agentes/novo` acessível apenas por administradores.

---

## Estrutura do Wizard

O formulário será dividido em **5 abas/etapas**:

```text
+----------+--------+---------------+--------+------+
| CLIENTE  | PLANOS | CONFIGURAÇÕES | PROMPT | CRM  |
+----------+--------+---------------+--------+------+
```

---

## Etapa 1: Cliente

Campos para identificação do cliente e código do agente.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Código do Agente | Input (texto) | Identificador único do agente (ex: `AG001`) |
| Cliente | Select/Combobox | Seleção de cliente existente OU criação de novo |
| É Closer? | Switch | Define se o agente é do tipo closer |

**Seção "Novo Cliente" (condicional):**
| Campo | Tipo |
|-------|------|
| Nome | Input |
| Razão Social | Input |
| CPF/CNPJ | Input com máscara |
| E-mail | Input |
| Telefone | Input com máscara |

---

## Etapa 2: Planos

Configuração do plano e limites do agente.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Plano | Select | Lista de planos disponíveis |
| Limite de Leads | Input (número) | Override do limite do plano |
| Dia do Vencimento | Input (número 1-31) | Dia do mês para renovação |

---

## Etapa 3: Configurações

Configurações avançadas em formato JSON.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Configurações JSON | Textarea | Objeto JSON com configs customizadas |

---

## Etapa 4: Prompt

Prompt base do agente IA.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Prompt do Sistema | Textarea (grande) | Instruções de personalidade e comportamento |

---

## Etapa 5: CRM

Integração com serviços externos (Helena) e WhatsApp.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| Helena Count ID | Input (número) | ID de contagem no sistema Helena |
| Helena Token | Input | Token de autenticação Helena |
| País | Select | Código do país para WhatsApp |
| Número WhatsApp | Input com máscara | Número da instância WhatsApp |

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/agents/CreateAgentPage.tsx` | Página principal do wizard |
| `src/pages/agents/components/CreateAgentWizard.tsx` | Componente wizard com Tabs |
| `src/pages/agents/components/wizard-steps/ClientStep.tsx` | Etapa 1 - Cliente |
| `src/pages/agents/components/wizard-steps/PlanStep.tsx` | Etapa 2 - Planos |
| `src/pages/agents/components/wizard-steps/ConfigStep.tsx` | Etapa 3 - Configurações |
| `src/pages/agents/components/wizard-steps/PromptStep.tsx` | Etapa 4 - Prompt |
| `src/pages/agents/components/wizard-steps/CRMStep.tsx` | Etapa 5 - CRM |

---

## Alterações em Arquivos Existentes

| Arquivo | Alteração |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/admin/agentes/novo` dentro do `AdminRoute` |

---

## Layout Visual

A página utilizará os componentes shadcn/ui existentes:
- `Card` para container principal
- `Tabs` + `TabsList` + `TabsContent` para navegação entre etapas
- `Form` + `FormField` + `FormItem` para campos
- `Input`, `Textarea`, `Select`, `Switch` para inputs
- `Button` para navegação (Anterior/Próximo/Salvar)

---

## Navegação do Wizard

```text
┌─────────────────────────────────────────────────────────┐
│  ← Voltar para Lista                  Agentes IA / Novo │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [ Cliente ] [ Planos ] [ Config ] [ Prompt ] [ CRM ]   │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                  │   │
│  │  [Campos da etapa atual]                        │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│            [ ← Anterior ]    [ Próximo → ]              │
│                   ou                                    │
│              [ Salvar Agente ]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Estados do Formulário

| Estado | Tipo | Descrição |
|--------|------|-----------|
| `currentStep` | number | Etapa atual (0-4) |
| `formData` | object | Todos os dados do formulário |
| `isSubmitting` | boolean | Indicador de salvamento |
| `errors` | object | Erros de validação por campo |

---

## Componentes UI Utilizados

- `@/components/ui/card`
- `@/components/ui/tabs`
- `@/components/ui/input`
- `@/components/ui/textarea`
- `@/components/ui/select`
- `@/components/ui/switch`
- `@/components/ui/button`
- `@/components/ui/label`
- `@/components/ui/separator`
- `@/lib/inputMasks` (máscaras existentes)

---

## Escopo Inicial

Esta implementação é **apenas layout/UI**. A lógica de salvamento no banco de dados será implementada posteriormente após validação do layout.
