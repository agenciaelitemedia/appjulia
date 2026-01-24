

# Plano: Implementação da Página de FollowUP do Agente

## Resumo
Criar a página de configuração e monitoramento de FollowUP do agente Julia, replicando a funcionalidade do sistema PHP original. A página permitirá configurar as cadências de reengajamento automático e visualizar a fila de mensagens agendadas.

---

## Estrutura de Dados Identificada

### Tabela `followup_config` (Configuração por agente)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| cod_agent | bigint | Código do agente |
| step_cadence | jsonb | Intervalos de cada etapa (ex: "5 minutes", "1 days") |
| msg_cadence | jsonb | Mensagens personalizadas por etapa (opcional) |
| title_cadence | jsonb | Títulos amigáveis das etapas |
| start_hours | smallint | Hora de início do envio (ex: 9) |
| end_hours | smallint | Hora de fim do envio (ex: 19) |
| auto_message | boolean | Gerar mensagem automática via IA |
| followup_from | smallint | Etapa inicial do fluxo |
| followup_to | smallint | Etapa final do fluxo |

### Tabela `followup_queue` (Fila de envios)
| Campo | Tipo | Descrição |
|-------|------|-----------|
| session_id | varchar | Número do WhatsApp do lead |
| step_number | smallint | Etapa atual do followup |
| send_date | timestamp | Data/hora agendada para envio |
| state | varchar | SEND, QUEUE, STOP |
| history | text | Contexto da conversa |
| name_client | varchar | Nome do cliente |

---

## Arquivos a Criar

```text
src/pages/agente/
    |-- followup/
    |       |-- FollowupPage.tsx           # Página principal
    |       |-- components/
    |       |       |-- FollowupConfig.tsx       # Configuração das cadências
    |       |       |-- FollowupQueue.tsx        # Tabela da fila
    |       |       |-- FollowupSummary.tsx      # Cards de resumo
    |       |       |-- CadenceStepEditor.tsx    # Editor de etapas
    |-- types.ts                            # Tipos TypeScript
    |-- hooks/
            |-- useFollowupData.ts          # Hooks de dados
```

---

## Componentes Principais

### 1. FollowupPage.tsx
Página principal com duas abas:
- **Configuração**: Formulário para editar cadências do agente
- **Fila de Envios**: Tabela com mensagens pendentes/enviadas

### 2. FollowupConfig.tsx
Formulário de configuração contendo:
- Toggle "Mensagem Automática" (auto_message)
- Seletor de horário de funcionamento (start_hours/end_hours)
- Editor de etapas (cadence_1, cadence_2, etc.)
  - Título da etapa
  - Intervalo (5 min, 15 min, 1 dia, etc.)
  - Mensagem personalizada (opcional)
- Botões Adicionar/Remover etapa
- Botão Salvar

### 3. FollowupQueue.tsx
Tabela com colunas:
- WhatsApp (session_id)
- Nome do Cliente
- Etapa Atual
- Status (SEND/QUEUE/STOP)
- Data Agendada
- Última Mensagem (history truncado)
- Ações (Ver chat, Pausar, Remover)

### 4. FollowupSummary.tsx
Cards de métricas:
- Total na Fila
- Aguardando Envio (QUEUE)
- Enviados (SEND)
- Pausados (STOP)

---

## Interface de Configuração

```text
+----------------------------------------------------------+
|  FollowUP - Configuração do Agente                       |
+----------------------------------------------------------+
|                                                          |
|  [x] Mensagem Automática (gerada pela IA Julia)          |
|                                                          |
|  Horário de Envio: [09:00] às [19:00]                   |
|                                                          |
|  +----------------------------------------------------+  |
|  | Etapa 1: 5 minutos                                 |  |
|  | Título: "Primeiro contato"                         |  |
|  | Mensagem: (automática)                     [Editar]|  |
|  +----------------------------------------------------+  |
|  | Etapa 2: 15 minutos                                |  |
|  | Título: "Reforço"                                  |  |
|  | Mensagem: (automática)                     [Editar]|  |
|  +----------------------------------------------------+  |
|  | Etapa 3: 1 dia                                     |  |
|  | Título: "Dia seguinte"                             |  |
|  | Mensagem: (automática)                     [Editar]|  |
|  +----------------------------------------------------+  |
|                                                          |
|  [+ Adicionar Etapa]                                     |
|                                                          |
|  [Salvar Configurações]                                  |
+----------------------------------------------------------+
```

---

## Hooks de Dados

### useFollowupConfig(codAgent)
```typescript
// Busca configuração atual do agente
SELECT * FROM followup_config WHERE cod_agent = $1

// Salva configuração
UPDATE followup_config SET 
  step_cadence = $2,
  msg_cadence = $3,
  title_cadence = $4,
  start_hours = $5,
  end_hours = $6,
  auto_message = $7
WHERE cod_agent = $1
```

### useFollowupQueue(filters)
```typescript
// Busca fila de followups com filtros
SELECT 
  fq.id, fq.session_id, fq.step_number, fq.send_date,
  fq.state, fq.history, fq.name_client, fq.created_at
FROM followup_queue fq
WHERE fq.cod_agent = $1
  AND fq.created_at >= $2
  AND fq.created_at <= $3
ORDER BY fq.send_date DESC
```

---

## Tipos TypeScript

```typescript
interface FollowupConfig {
  id: number;
  cod_agent: string;
  step_cadence: Record<string, string>;   // { cadence_1: "5 minutes", ... }
  msg_cadence: Record<string, string | null>;
  title_cadence: Record<string, string>;
  start_hours: number;
  end_hours: number;
  auto_message: boolean;
  followup_from: number | null;
  followup_to: number | null;
  created_at: string;
  updated_at: string;
}

interface FollowupQueueItem {
  id: number;
  cod_agent: string;
  session_id: string;
  step_number: number;
  send_date: string;
  state: 'SEND' | 'QUEUE' | 'STOP';
  history: string | null;
  name_client: string;
  created_at: string;
  hub: string;
  chat_memory: string;
}
```

---

## Alterações em Arquivos Existentes

### src/App.tsx
Adicionar rota:
```typescript
import FollowupPage from './pages/agente/followup/FollowupPage';

<Route path="/agente/followup" element={<FollowupPage />} />
```

---

## Funcionalidades da Fila

### Estados da Fila
| Estado | Descrição | Cor |
|--------|-----------|-----|
| QUEUE | Aguardando horário de envio | Amarelo |
| SEND | Mensagem já enviada | Verde |
| STOP | Pausado (lead respondeu) | Cinza |

### Ações na Fila
- **Ver Chat**: Abre WhatsAppMessagesDialog
- **Pausar**: Altera state para STOP
- **Remover**: Remove da fila

---

## Implementação Passo a Passo

1. **Criar estrutura de pastas e tipos**
   - src/pages/agente/types.ts
   - src/pages/agente/hooks/useFollowupData.ts

2. **Criar componentes de UI**
   - FollowupSummary.tsx (cards de resumo)
   - FollowupQueue.tsx (tabela da fila)
   - FollowupConfig.tsx (formulário de configuração)
   - CadenceStepEditor.tsx (editor de etapas)

3. **Criar página principal**
   - FollowupPage.tsx com abas Configuração/Fila

4. **Registrar rota**
   - Adicionar em App.tsx

5. **Testar e ajustar**
   - Verificar queries SQL
   - Testar salvamento de configuração
   - Validar filtros e paginação

---

## Seção Técnica

### Padrões a Seguir
- Usar `externalDb.raw()` para consultas SQL (mesmo padrão das outras páginas)
- Timezone: `(created_at AT TIME ZONE 'America/Sao_Paulo')::date`
- Filtros: Reutilizar componente JuliaFilters com adaptações
- Paginação: 20 itens por página (ITEMS_PER_PAGE)
- Toast notifications via `useToast()`

### Estrutura JSONB das Cadências
O banco armazena as cadências como objetos JSONB com chaves dinâmicas:
```json
{
  "cadence_1": "5 minutes",
  "cadence_2": "15 minutes", 
  "cadence_3": "1 days"
}
```

A interface deve permitir adicionar/remover etapas dinamicamente, atualizando as chaves sequencialmente.

### Opções de Intervalo
- 5 minutes, 10 minutes, 15 minutes, 30 minutes
- 1 hours, 2 hours, 4 hours, 8 hours
- 1 days, 2 days, 3 days, 7 days

