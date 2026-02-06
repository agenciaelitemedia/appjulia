

# Plano: Busca Processual Nacional via API DataJud

## Visão Geral

Criar um módulo de busca processual em todos os tribunais do Brasil utilizando a API pública DataJud do CNJ. O sistema permitira buscas por:
- **Numero do Processo** (formato CNJ: NNNNNNN-DD.AAAA.J.TR.OOOO)
- **CNPJ** da parte envolvida
- **OAB** do advogado

## Arquitetura da Solucao

```text
+------------------+      +----------------------+      +------------------+
|   Frontend       | ---> |   Edge Function      | ---> |   DataJud API    |
|   React/TS       |      |   datajud-search     |      |   (CNJ)          |
+------------------+      +----------------------+      +------------------+
        |                         |
        v                         v
  [Cache Local]           [Logs de Busca]
  (React Query)           (Supabase DB)
```

## Funcionalidades Principais

### 1. Pagina de Busca Processual
- Campo de busca inteligente com deteccao automatica do tipo (CPF/CNPJ, OAB, numero processo)
- Filtro de tribunal especifico (opcional - se nao selecionado, busca em todos)
- Indicador visual de progresso durante busca em multiplos tribunais
- Resultados agrupados por tribunal

### 2. Tipos de Busca Suportados
| Tipo | Formato | Exemplo |
|------|---------|---------|
| Numero CNJ | NNNNNNN-DD.AAAA.J.TR.OOOO | 0001234-56.2024.8.26.0100 |
| CNPJ | XX.XXX.XXX/XXXX-XX | 12.345.678/0001-99 |
| OAB | UF + numero | SP123456 ou OAB/SP 123.456 |

### 3. Detalhes do Processo
- Classe e assunto processual
- Orgao julgador e tribunal
- Movimentacoes recentes (timeline interativa)
- Partes envolvidas (com protecao LGPD)
- Valor da causa (quando disponivel)

---

## Componentes de Interface (UI/UX)

### Header da Pagina
- Titulo com icone representativo (Scale/Gavel)
- Subtitulo descritivo
- Acesso rapido a historico de buscas

### Barra de Busca Principal
- Input grande e centralizado com visual destacado
- Placeholder dinamico conforme tipo selecionado
- Botoes de tipo de busca (chips selecionaveis)
- Dropdown de selecao de tribunal (opcional)
- Botao de busca com feedback de loading

### Cards de Resultado
- Design moderno com badges coloridos por status
- Numero do processo destacado
- Tribunal e classe processual
- Ultima movimentacao com data
- Botao para expandir detalhes

### Painel de Detalhes
- Sheet lateral (slide-in) com informacoes completas
- Timeline de movimentacoes
- Secoes colapsaveis para organizacao
- Botao para exportar/compartilhar

### Estados da Interface
- Loading: Skeleton animado + indicador de tribunais sendo consultados
- Vazio: Ilustracao + texto orientativo
- Erro: Mensagem amigavel + opcao de retry
- Sem resultados: Sugestoes de ajuste na busca

---

## Detalhes Tecnicos

### Edge Function: datajud-search

**Endpoint**: POST /functions/v1/datajud-search

**Acoes**:
- `search_by_number`: Busca por numero do processo
- `search_by_document`: Busca por CNPJ/CPF
- `search_by_lawyer`: Busca por numero OAB
- `get_movements`: Obtem movimentacoes detalhadas

**Headers DataJud**:
```text
Authorization: APIKey [chave publica CNJ]
Content-Type: application/json
```

**Endpoints dos Tribunais** (91 endpoints):
- Superiores: STF, STJ, TST, TSE, STM
- Federais: TRF1 a TRF6
- Estaduais: TJ + sigla do estado (ex: TJSP, TJRJ)
- Trabalhistas: TRT1 a TRT24
- Eleitorais: TRE + sigla do estado
- Militares: TJM estaduais

### Banco de Dados

**Tabela: datajud_search_logs**
```text
- id (uuid)
- user_id (referencia profiles)
- search_type (enum: process_number, document, lawyer)
- search_query (texto)
- tribunals_searched (array)
- results_count (integer)
- response_time_ms (integer)
- created_at (timestamp)
```

### Frontend

**Arquivos a criar**:
```text
src/pages/datajud/
  DataJudSearchPage.tsx         # Pagina principal
  components/
    SearchBar.tsx               # Barra de busca inteligente
    TribunalSelector.tsx        # Seletor de tribunais
    ProcessCard.tsx             # Card de resultado
    ProcessDetailsSheet.tsx     # Detalhes do processo
    MovementTimeline.tsx        # Timeline de movimentacoes
    SearchTypeSelector.tsx      # Seletor de tipo de busca
    SearchProgress.tsx          # Indicador de progresso
  hooks/
    useDataJudSearch.ts         # Hook principal de busca
    useTribunalList.ts          # Lista de tribunais disponiveis
  types.ts                      # Tipos TypeScript
  utils.ts                      # Utilitarios (formatacao, validacao)
```

---

## Lista de Tribunais DataJud

### Tribunais Superiores
- api_publica_stf, api_publica_stj, api_publica_tst, api_publica_tse, api_publica_stm

### Justica Federal (TRFs)
- api_publica_trf1 a api_publica_trf6

### Justica Estadual (TJs)
- api_publica_tjac, tjal, tjam, tjap, tjba, tjce, tjdft, tjes, tjgo, tjma, tjmg, tjms, tjmt, tjpa, tjpb, tjpe, tjpi, tjpr, tjrj, tjrn, tjro, tjrr, tjrs, tjsc, tjse, tjsp, tjto

### Justica do Trabalho (TRTs)
- api_publica_trt1 a api_publica_trt24

### Justica Eleitoral (TREs)
- api_publica_tre + sigla

### Justica Militar
- api_publica_tjmmg, tjmrs, tjmsp

---

## Etapas de Implementacao

### Etapa 1: Backend (Edge Function)
1. Criar `supabase/functions/datajud-search/index.ts`
2. Implementar logica de busca por numero do processo
3. Implementar busca por CNPJ
4. Implementar busca por OAB
5. Adicionar busca paralela em multiplos tribunais
6. Tratamento de erros e timeouts

### Etapa 2: Banco de Dados
1. Criar tabela `datajud_search_logs` para historico
2. Configurar RLS policies

### Etapa 3: Frontend - Estrutura Base
1. Criar pagina `DataJudSearchPage.tsx`
2. Implementar componente `SearchBar.tsx`
3. Implementar `SearchTypeSelector.tsx`
4. Implementar `TribunalSelector.tsx`

### Etapa 4: Frontend - Resultados
1. Implementar `ProcessCard.tsx`
2. Implementar `ProcessDetailsSheet.tsx`
3. Implementar `MovementTimeline.tsx`
4. Implementar `SearchProgress.tsx`

### Etapa 5: Hooks e Integracao
1. Criar `useDataJudSearch.ts`
2. Criar `useTribunalList.ts`
3. Integrar com React Query

### Etapa 6: Roteamento
1. Adicionar rota em `App.tsx`
2. Adicionar item no menu lateral (se aplicavel)

---

## Destaques de UX

### Busca Inteligente
- Deteccao automatica do tipo de documento digitado
- Mascara automatica para CNPJ e numero CNJ
- Sugestoes de tribunais baseadas no numero do processo

### Feedback Visual
- Animacao de loading por tribunal
- Contagem regressiva de tribunais restantes
- Toast de sucesso/erro
- Highlight do termo buscado nos resultados

### Responsividade
- Layout adaptado para mobile
- Cards empilhados em telas pequenas
- Bottom sheet para detalhes em mobile

### Acessibilidade
- Labels adequados para screen readers
- Navegacao por teclado
- Contraste adequado de cores

