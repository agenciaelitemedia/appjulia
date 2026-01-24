
# Plano: Implementar Paginas Desempenho e Contratos Julia

## Resumo

Criar duas novas paginas no modulo Estrategico clonando a estrutura existente do CRM:
1. **Desempenho Julia** (`/estrategico/desempenho`) - Lista de sessoes com metricas de atendimento
2. **Contratos Julia** (`/estrategico/contratos`) - Lista de contratos assinados/em curso

---

## Dados Disponiveis

### View: `vw_desempenho_julia` (Sessoes)
| Campo | Tipo | Descricao |
|-------|------|-----------|
| cod_agent | bigint | Codigo do agente |
| agent_id | bigint | ID do agente |
| name | varchar | Nome do proprietario |
| business_name | varchar | Nome do escritorio |
| client_id | bigint | ID do cliente |
| perfil_agent | text | Tipo: SDR ou CLOSER |
| session_id | bigint | ID da sessao |
| total_msg | bigint | Total de mensagens |
| whatsapp | bigint | Numero do WhatsApp |
| status_document | varchar | Status do documento |
| max_created_at | timestamp | Ultima mensagem |
| created_at | timestamp | Inicio da sessao |

### View: `vw_desempenho_julia_contratos` (Contratos)
| Campo | Tipo | Descricao |
|-------|------|-----------|
| cod_agent | bigint | Codigo do agente |
| name | varchar | Nome do proprietario |
| business_name | varchar | Nome do escritorio |
| session_id | bigint | ID da sessao |
| whatsapp | bigint | Numero do WhatsApp |
| cod_document | varchar | UUID do documento |
| status_document | varchar | CREATED, SIGNED, etc |
| situacao | text | EM CURSO, etc |
| data_contrato | timestamp | Data de criacao |
| data_assinatura | timestamp | Data da assinatura |
| resumo_do_caso | text | Resumo do caso |
| signer_name | varchar | Nome do signatario |
| signer_cpf | varchar | CPF do signatario |
| signer_uf | varchar | UF |
| signer_cidade | varchar | Cidade |
| case_title | varchar | Titulo do caso |
| case_category_name | varchar | Categoria |
| case_category_color | varchar | Cor da categoria |

---

## Estrutura de Arquivos a Criar

```text
src/pages/estrategico/
├── types.ts                          # Tipos TypeScript
├── hooks/
│   └── useJuliaData.ts               # Hooks de dados
├── desempenho/
│   ├── DesempenhoPage.tsx            # Pagina principal
│   └── components/
│       ├── DesempenhoFilters.tsx     # Filtros (clone de CRMFilters)
│       ├── DesempenhoTable.tsx       # Tabela de sessoes
│       └── DesempenhoSummary.tsx     # Cards de resumo
└── contratos/
    ├── ContratosPage.tsx             # Pagina principal
    └── components/
        ├── ContratosFilters.tsx      # Filtros
        ├── ContratosTable.tsx        # Tabela de contratos
        ├── ContratoDetailsDialog.tsx # Dialog de detalhes
        └── ContratosSummary.tsx      # Cards de resumo
```

---

## Implementacao Detalhada

### 1. Tipos TypeScript (`src/pages/estrategico/types.ts`)

```typescript
export interface JuliaFiltersState {
  search: string;
  agentCodes: string[];
  dateFrom: string;
  dateTo: string;
  perfilAgent?: 'SDR' | 'CLOSER' | 'ALL';
  statusDocument?: string;
}

export interface JuliaSessao {
  cod_agent: string;
  agent_id: number;
  name: string;
  business_name: string;
  client_id: number;
  perfil_agent: string;
  session_id: number;
  total_msg: number;
  whatsapp: string;
  status_document: string | null;
  max_created_at: string;
  created_at: string;
}

export interface JuliaContrato {
  cod_agent: string;
  agent_id: number;
  name: string;
  business_name: string;
  client_id: number;
  perfil_agent: string;
  session_id: number;
  total_msg: number;
  whatsapp: string;
  cod_document: string;
  status_document: string;
  situacao: string;
  data_contrato: string;
  data_assinatura: string | null;
  resumo_do_caso: string | null;
  signer_name: string | null;
  signer_cpf: string | null;
  signer_uf: string | null;
  signer_cidade: string | null;
  signer_bairro: string | null;
  signer_endereco: string | null;
  signer_cep: string | null;
  case_title: string | null;
  case_category_name: string | null;
  case_category_color: string | null;
  is_confirm: string;
}

export interface JuliaSummary {
  totalSessoes: number;
  totalMensagens: number;
  mediaMsg: number;
  sessoesHoje: number;
}

export interface JuliaContratoSummary {
  totalContratos: number;
  contratosAssinados: number;
  contratosEmCurso: number;
  taxaAssinatura: number;
}
```

---

### 2. Hooks de Dados (`src/pages/estrategico/hooks/useJuliaData.ts`)

```typescript
import { useQuery } from '@tanstack/react-query';
import { externalDb } from '@/lib/externalDb';
import { useAuth } from '@/contexts/AuthContext';
import { JuliaSessao, JuliaContrato, JuliaFiltersState } from '../types';

export function useJuliaSessoes(filters: JuliaFiltersState) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['julia-sessoes', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo, perfilAgent } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<JuliaSessao>({
        query: `
          SELECT 
            cod_agent::text, agent_id, name, business_name, client_id,
            perfil_agent, session_id, total_msg::int, whatsapp::text,
            status_document, max_created_at, created_at
          FROM vw_desempenho_julia
          WHERE cod_agent::text = ANY($1::varchar[])
            AND created_at >= $2::timestamp
            AND created_at <= ($3::timestamp + interval '1 day')
            ${perfilAgent && perfilAgent !== 'ALL' ? "AND perfil_agent = $4" : ""}
          ORDER BY created_at DESC
        `,
        params: perfilAgent && perfilAgent !== 'ALL' 
          ? [agentCodes, dateFrom, dateTo, perfilAgent]
          : [agentCodes, dateFrom, dateTo],
      });
      
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}

export function useJuliaContratos(filters: JuliaFiltersState) {
  return useQuery({
    queryKey: ['julia-contratos', filters],
    queryFn: async () => {
      const { agentCodes, dateFrom, dateTo, statusDocument } = filters;
      
      if (agentCodes.length === 0) return [];
      
      const result = await externalDb.raw<JuliaContrato>({
        query: `
          SELECT 
            cod_agent::text, agent_id, name, business_name, client_id,
            perfil_agent, session_id, total_msg::int, whatsapp::text,
            cod_document, status_document, situacao,
            data_contrato, data_assinatura,
            resumo_do_caso, signer_name, signer_cpf, signer_uf,
            signer_cidade, signer_bairro, signer_endereco, signer_cep,
            case_title, case_category_name, case_category_color, is_confirm
          FROM vw_desempenho_julia_contratos
          WHERE cod_agent::text = ANY($1::varchar[])
            AND data_contrato >= $2::timestamp
            AND data_contrato <= ($3::timestamp + interval '1 day')
            ${statusDocument ? "AND status_document = $4" : ""}
          ORDER BY data_contrato DESC
        `,
        params: statusDocument 
          ? [agentCodes, dateFrom, dateTo, statusDocument]
          : [agentCodes, dateFrom, dateTo],
      });
      
      return result;
    },
    enabled: filters.agentCodes.length > 0,
  });
}
```

---

### 3. Pagina de Desempenho (`src/pages/estrategico/desempenho/DesempenhoPage.tsx`)

A pagina tera:
- Header com titulo e botao de atualizar
- Cards de resumo (Total Sessoes, Total Mensagens, Media por Sessao, Sessoes Hoje)
- Filtros (Agentes, Datas, Perfil, Busca)
- Tabela com colunas: Agente, WhatsApp, Perfil, Mensagens, Inicio, Ultima Msg, Status

---

### 4. Pagina de Contratos (`src/pages/estrategico/contratos/ContratosPage.tsx`)

A pagina tera:
- Header com titulo e botao de atualizar
- Cards de resumo (Total Contratos, Assinados, Em Curso, Taxa de Assinatura)
- Filtros (Agentes, Datas, Status do Documento, Busca)
- Tabela com colunas: Agente, Cliente, WhatsApp, Status, Situacao, Data Contrato, Data Assinatura
- Dialog de detalhes ao clicar no contrato

---

### 5. Componente de Tabela de Sessoes (`DesempenhoTable.tsx`)

```typescript
// Colunas da tabela:
// - Agente (cod_agent + name)
// - WhatsApp (link clicavel)
// - Perfil (badge SDR/CLOSER)
// - Mensagens (total_msg)
// - Inicio (created_at formatado)
// - Ultima Msg (max_created_at formatado)
// - Status (badge colorido)
```

---

### 6. Componente de Tabela de Contratos (`ContratosTable.tsx`)

```typescript
// Colunas da tabela:
// - Agente (cod_agent + name)
// - Cliente (signer_name)
// - WhatsApp (link clicavel)
// - Status (badge: CREATED, SIGNED)
// - Situacao (badge: EM CURSO, etc)
// - Data Contrato (data_contrato formatado)
// - Assinatura (data_assinatura formatado ou "Pendente")
// - Acoes (botao ver detalhes)
```

---

### 7. Dialog de Detalhes do Contrato (`ContratoDetailsDialog.tsx`)

Mostrara:
- Informacoes do contrato (cod_document, status, situacao)
- Dados do signatario (nome, CPF, endereco completo)
- Resumo do caso (resumo_do_caso)
- Vinculo com processo (case_title, case_category)

---

### 8. Rotas no App.tsx

```typescript
import DesempenhoPage from './pages/estrategico/desempenho/DesempenhoPage';
import ContratosPage from './pages/estrategico/contratos/ContratosPage';

// Dentro do MainLayout:
<Route path="/estrategico/desempenho" element={<DesempenhoPage />} />
<Route path="/estrategico/contratos" element={<ContratosPage />} />
```

---

## Design Visual

### Cards de Resumo (4 cards no topo)

```text
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ 📊 Total       │ │ 💬 Mensagens   │ │ 📈 Media/Sessao│ │ 📅 Hoje        │
│    1.247       │ │    15.432      │ │    12,4        │ │    23          │
│ sessoes        │ │ enviadas       │ │ mensagens      │ │ sessoes        │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

### Badges de Status

| Status | Cor |
|--------|-----|
| CREATED | `bg-yellow-100 text-yellow-800` |
| SIGNED | `bg-green-100 text-green-800` |
| SDR | `bg-blue-100 text-blue-800` |
| CLOSER | `bg-purple-100 text-purple-800` |
| EM CURSO | `bg-orange-100 text-orange-800` |

---

## Ordem de Implementacao

1. Criar estrutura de pastas e types.ts
2. Implementar hooks de dados (useJuliaData.ts)
3. Criar pagina de Desempenho com tabela basica
4. Criar pagina de Contratos com tabela basica
5. Adicionar rotas no App.tsx
6. Implementar componentes de resumo (Summary cards)
7. Implementar filtros reutilizando CRMFilters
8. Implementar dialog de detalhes do contrato
9. Adicionar formatacao de datas com timezone correto

---

## Reutilizacao de Componentes

| Componente Existente | Uso na Nova Pagina |
|---------------------|-------------------|
| `CRMFilters.tsx` | Base para `DesempenhoFilters` e `ContratosFilters` |
| `useCRMAgents` | Reutilizar para lista de agentes |
| `formatDbDateTime` | Formatacao de timestamps |
| `Badge`, `Table`, `Card` | Componentes UI |

---

## Consideracoes de Timezone

Todas as datas serao formatadas usando as funcoes de `dateUtils.ts`:
- `formatDbDateTime()` para timestamps completos
- `formatDbTime()` para apenas hora
- `formatDateOnlySaoPaulo()` para apenas data

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rotas |
| Novos arquivos | Criar estrutura completa |

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/estrategico/types.ts` | Tipos TypeScript |
| `src/pages/estrategico/hooks/useJuliaData.ts` | Hooks de dados |
| `src/pages/estrategico/desempenho/DesempenhoPage.tsx` | Pagina principal |
| `src/pages/estrategico/desempenho/components/DesempenhoTable.tsx` | Tabela |
| `src/pages/estrategico/desempenho/components/DesempenhoSummary.tsx` | Cards |
| `src/pages/estrategico/contratos/ContratosPage.tsx` | Pagina principal |
| `src/pages/estrategico/contratos/components/ContratosTable.tsx` | Tabela |
| `src/pages/estrategico/contratos/components/ContratoDetailsDialog.tsx` | Dialog |
| `src/pages/estrategico/contratos/components/ContratosSummary.tsx` | Cards |

---

## Resultado Esperado

1. Menu "Desempenho" funcional com lista de sessoes da Julia
2. Menu "Contratos Julia" funcional com lista de contratos
3. Filtros por agente, data e status
4. Detalhes completos do contrato em dialog
5. Timezone correto (Brasilia) em todas as datas
6. Design consistente com o restante do sistema
