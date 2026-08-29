# Especificação Técnica: Julia MCP Server (Model Context Protocol)

Este documento especifica a arquitetura, catálogo de ferramentas (*Tools*), recursos (*Resources*), prompts pré-definidos e guia de implementação do **Servidor MCP da Julia** (Model Context Protocol). 

Com este servidor MCP, qualquer agente de IA ou cliente compatível (como **OpenClaw**, **Claude Desktop**, **Cursor**, **ChatGPT Pro com MCP**, ou automações locais) ganha acesso completo, estruturado e em tempo real a todo o ecossistema da Julia: conversas de WhatsApp, transcrições de áudios, anexos e documentos (PDFs/laudos), histórico de atendimentos, CRMs (Leads e Builder), contratos ZapSign assinados/em curso, filas, campanhas, agentes de IA e usuários do sistema.

---

## 1. Visão Geral da Arquitetura

O **Model Context Protocol (MCP)** é o padrão aberto da indústria para conectar modelos de linguagem a fontes de dados e ferramentas operacionais.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLIENTES MCP EXTERNOS                                   │
│    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────────────┐    │
│    │    OpenClaw      │    │  Claude Desktop  │    │  Cursor / ChatGPT / CLI      │    │
│    └────────┬─────────┘    └────────┬─────────┘    └──────────────┬───────────────┘    │
└─────────────┼───────────────────────┼─────────────────────────────┼────────────────────┘
              │                       │ (Transporte SSE / Streamable│HTTP)
              ▼                       ▼                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              JULIA MCP SERVER                                          │
│             (Edge Function `supabase/functions/copiloto-mcp` ou Daemon Node/Deno)      │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │                            CAMADA DE SEGURANÇA & AUTH                            │  │
│  │  - Validação de API Key / Bearer Token do Escritório                             │  │
│  │  - Resolução forçada de `client_id` (Isolamento Multi-Tenant estrito)            │  │
│  │  - Controle de Acesso Baseado em Papéis (RBAC / AppRole: admin, advogado, etc.)   │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │                                            │
│  ┌────────────────────────────────────────┴─────────────────────────────────────────┐  │
│  │                               CATÁLOGO DE FERRAMENTAS                            │  │
│  │  [Chat & Mídia]      [CRMs da Julia]       [Contratos ZapSign]  [Equipe & Filas] │  │
│  │  • ler_conversa      • crm_listar_cards    • contratos_listar   • usuarios_listar│  │
│  │  • listar_arquivos   • crm_obter_card      • contratos_detalhes • filas_listar   │  │
│  │  • ler_documento     • builder_deals       • download_assinado  • campanhas_ads  │  │
│  │  • dados_atendimento • crm_metricas_painel • resumo_juridico    • agentes_status │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
└───────────────────────────────────────────┼────────────────────────────────────────────┘
                                            │
             ┌──────────────────────────────┴──────────────────────────────┐
             ▼                                                             ▼
┌─────────────────────────────────────────┐   ┌──────────────────────────────────────────┐
│         SUPABASE DA JULIA               │   │         POSTGRES EXTERNO LEGADO          │
│  - chat_messages, chat_conversations    │   │  (Via driver seguro / db-query)          │
│  - chat_contacts, chat_media (Storage)  │   │  - users, clients, agents, user_agents   │
│  - crm_boards, crm_deals, crm_pipelines │   │  - crm_atendimento_cards/stages/history  │
│  - queues, chat_campaigns, telemetria   │   │  - campaing_ads, JuliaContrato (ZapSign) │
└─────────────────────────────────────────┘   └──────────────────────────────────────────┘
```

---

## 2. Autenticação, Multi-Tenancy e Segurança

### 2.1 Resolução do `client_id` (Isolamento Obrigatório)
Como a RLS da Julia é permissiva (`USING (true)`), o servidor MCP **nunca aceita `client_id` vindo como parâmetro da IA**.
* Toda requisição MCP deve enviar o header `Authorization: Bearer <JULIA_MCP_TOKEN>`.
* O token é validado na tabela `ai_provider_keys` ou `chat_api_keys`, identificando com precisão o `client_id` e o `user_id` do advogado que emitiu o token.
* Todas as queries SQL injetam automaticamente o filtro `.eq('client_id', authenticatedClientId)` ou `WHERE client_id = $1`.

### 2.2 Níveis de Acesso por Perfil (`AppRole`)
* **`admin` / `user`**: Acesso a todos os dados do escritório (financeiro, contratos, todos os atendentes).
* **`advogado` / `time`**: Acesso às conversas das filas atribuídas e aos seus próprios cards de CRM.
* **`comercial`**: Acesso a leads, campanhas e deals, com dados sensíveis de peças restritos.

---

## 3. Catálogo Completo de Ferramentas (MCP Tools)

As ferramentas estão divididas em **9 domínios operacionais**.

---

### Domínio 1: Chat, Mensagens e Atendimento Omnichannel

#### 1. `julia_chat_listar_conversas`
Lista conversas ativas ou históricas do inbox com filtros avançados.
* **Argumentos (`inputSchema`)**:
  ```json
  {
    "type": "object",
    "properties": {
      "status": { "type": "string", "enum": ["all", "pending", "open", "resolved", "closed"], "description": "Status do atendimento" },
      "queue_id": { "type": "string", "description": "ID da fila específica (opcional)" },
      "assigned_user_id": { "type": "string", "description": "Filtrar por atendente responsável" },
      "search_query": { "type": "string", "description": "Buscar por nome do cliente ou número de telefone" },
      "tag_name": { "type": "string", "description": "Filtrar por tag (ex: Trabalhista, Urgente, Contrato)" },
      "limit": { "type": "number", "default": 20, "description": "Quantidade máxima de conversas (máx: 100)" }
    }
  }
  ```
* **Retorno**: Lista de conversas com ID, protocolo (`#YYYY-000001`), nome do contato, telefone, canal (`whatsapp_uazapi`, `whatsapp_waba`, `instagram`), status, prioridade, responsável atual e data da última mensagem.

---

#### 2. `julia_chat_obter_conversa`
Recupera o dossiê detalhado de um atendimento específico.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "conversation_id": { "type": "string", "description": "UUID da conversa" }
    },
    "required": ["conversation_id"]
  }
  ```
* **Retorno**: Metadados completos da conversa, tempos de SLA (FRT, NRT, TTR), status de CSAT, departamento, tags vinculadas, notas de encerramento (`close_note`) e ticket de suporte vinculado (se houver).

---

#### 3. `julia_chat_ler_mensagens`
Lê o histórico cronológico de mensagens trocadas no WhatsApp/canal.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "conversation_id": { "type": "string", "description": "UUID da conversa" },
      "limit": { "type": "number", "default": 100, "description": "Quantidade de mensagens a carregar" },
      "include_internal_notes": { "type": "boolean", "default": true, "description": "Incluir notas internas da equipe jurídica" }
    },
    "required": ["conversation_id"]
  }
  ```
* **Retorno**: Mensagens com:
  - Papel do emissor: `CLIENTE` ou `ATENDENTE (Nome do Operador)`.
  - Texto da mensagem.
  - **Áudios transcritos**: Para mensagens de voz/PTT, retorna o texto transcrito automaticamente pela Julia (`chat-transcribe-audio`).
  - Citações (mensagens respondidas) e reações emoji.
  - Timestamps precisos e identificador de tipo (`text`, `audio`, `document`, `image`).

---

#### 4. `julia_chat_listar_arquivos`
Lista todos os arquivos e mídias (PDFs, fotos de documentos, laudos, comprovantes) enviados pelo cliente ou atendente.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "conversation_id": { "type": "string", "description": "UUID da conversa" }
    },
    "required": ["conversation_id"]
  }
  ```
* **Retorno**: Array de documentos com:
  - `file_id`: ID da mensagem/mídia.
  - `file_name`: Nome original do arquivo (ex: `extrato_bancario_2026.pdf`, `cnh_frente_verso.jpg`).
  - `file_type`: `pdf`, `image`, `audio`, `document`.
  - `sender`: `CLIENTE` ou `ATENDENTE`.
  - `download_url`: URL temporária assinada para download/leitura.
  - `created_at`: Data e hora do envio.

---

#### 5. `julia_chat_ler_conteudo_arquivo`
Extrai o conteúdo textual de um arquivo específico enviado pelo lead (PDF, documento ou imagem com OCR).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "message_id": { "type": "string", "description": "ID da mensagem que contém o arquivo" },
      "max_pages": { "type": "number", "default": 10, "description": "Limite de páginas para leitura de PDFs" }
    },
    "required": ["message_id"]
  }
  ```
* **Retorno**: Texto bruto extraído e estruturado do documento (ideal para o modelo analisar contratos, holerites e certidões).

---

#### 6. `julia_chat_historico_atendimento`
Retorna a linha do tempo de auditoria do atendimento (`chat_conversation_history`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "conversation_id": { "type": "string", "description": "UUID da conversa" }
    },
    "required": ["conversation_id"]
  }
  ```
* **Retorno**: Linha do tempo contendo:
  - Quem abriu o atendimento e quando.
  - Transferências de atendentes (ex: *Dr. Lucas transferiu para Dra. Camila*).
  - Devoluções à fila e pausas (*Snooze*).
  - Resumos automáticos gerados pela IA no encerramento.

---

#### 7. `julia_chat_enviar_nota_interna`
Permite ao agente MCP registrar um parecer, checklist ou alerta jurídico diretamente na linha do tempo do atendimento na Julia.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "conversation_id": { "type": "string", "description": "UUID da conversa" },
      "text": { "type": "string", "description": "Conteúdo da nota interna" },
      "note_type": { "type": "string", "enum": ["info", "question", "urgent"], "default": "info" }
    },
    "required": ["conversation_id", "text"]
  }
  ```
* **Retorno**: Confirmação de gravação em `chat_messages` com `internal_note: true`.

---

### Domínio 2: Gestão de Contatos e Leads

#### 8. `julia_contatos_buscar`
Busca unificada de contatos por nome, WhatsApp ou CPF.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Nome, número de telefone (com ou sem 9º dígito) ou e-mail" }
    },
    "required": ["query"]
  }
  ```
* **Retorno**: Dados cadastrais do contato em `chat_contacts`, canal de origem, contagem de mensagens não lidas e data da última interação.

---

#### 9. `julia_contatos_obter_perfil`
Dossiê 360º do cliente: reúne dados cadastrais, histórico de todas as conversas anteriores, cards no CRM e contratos assinados.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "contact_id": { "type": "string", "description": "ID do contato" }
    },
    "required": ["contact_id"]
  }
  ```

---

### Domínio 3: CRM de Leads Julia (Kanban Clássico)

#### 10. `julia_crm_listar_cards`
Lista os leads do funil clássico de atendimento (`crm_atendimento_cards`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "cod_agent": { "type": "string", "description": "Código do Agente Julia (opcional)" },
      "stage_id": { "type": "number", "description": "ID do estágio do funil (opcional)" },
      "only_active": { "type": "boolean", "default": true, "description": "Apenas leads não finalizados (end_stage=false)" },
      "limit": { "type": "number", "default": 50 }
    }
  }
  ```
* **Retorno**: Leads no funil com: nome do contato, número do WhatsApp, estágio atual (`stage_name`), tempo de permanência no estágio (`hours_in_stage`), observações comerciais (`notes`) e responsável (`owner_name`).

---

#### 11. `julia_crm_obter_card`
Detalhes completos de um lead específico no CRM, incluindo histórico de transição de etapas (`crm_atendimento_history`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "card_id": { "type": "number", "description": "ID do card no CRM" }
    },
    "required": ["card_id"]
  }
  ```

---

#### 12. `julia_crm_listar_estagios`
Lista todos os estágios configurados no funil do escritório (`crm_atendimento_stages`), suas cores e posições.
* **Argumentos**: `{}` (nenhum argumento necessário).

---

#### 13. `julia_crm_metricas_paineis`
Retorna os indicadores consolidados de performance comercial e gargalos do CRM.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "cod_agent": { "type": "string", "description": "Código do agente (opcional)" },
      "period_days": { "type": "number", "default": 30, "description": "Janela de dias para análise (ex: 7, 30, 90)" }
    }
  }
  ```
* **Retorno**: Total de leads captados, taxa de qualificação MQL, taxa de contratos gerados/assinados, tempo médio de conversão e alertas de leads estagnados (*Stuck Leads*).

---

### Domínio 4: CRM Builder (Kanban Multi-Board Nativo)

#### 14. `julia_builder_listar_boards`
Lista os quadros Kanban personalizados criados no escritório (`crm_boards`).
* **Argumentos**: `{}`.
* **Retorno**: ID do board, nome, descrição, ícone e colunas/pipelines existentes.

---

#### 15. `julia_builder_listar_deals`
Lista os negócios/oportunidades de um board (`crm_deals`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "board_id": { "type": "string", "description": "UUID do Board" },
      "pipeline_id": { "type": "string", "description": "UUID da coluna/etapa (opcional)" },
      "status": { "type": "string", "enum": ["open", "won", "lost"], "default": "open" }
    },
    "required": ["board_id"]
  }
  ```
* **Retorno**: Deals com título, valor estimado, prioridade, responsável, campos customizados (`custom_fields`) e vínculo com conversas.

---

#### 16. `julia_builder_obter_deal`
Recupera detalhes, checklists e histórico de movimentação de um negócio no CRM Builder.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "deal_id": { "type": "string", "description": "UUID do Deal" }
    },
    "required": ["deal_id"]
  }
  ```

---

### Domínio 5: Contratos ZapSign & Gestão Jurídica

#### 17. `julia_contratos_listar`
Lista os contratos jurídicos gerados e gerenciados pela Julia (`JuliaContrato`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "status_document": { "type": "string", "enum": ["all", "CREATED", "SIGNED", "PENDING"], "default": "all" },
      "search": { "type": "string", "description": "Filtrar por nome do cliente ou WhatsApp" },
      "limit": { "type": "number", "default": 50 }
    }
  }
  ```
* **Retorno**: Lista de contratos com `cod_document`, `zapsing_doctoken`, status (`Em curso` / `Assinado`), dados dos signatários (`signer_name`, `signer_email`), data de envio, data de assinatura e resumo fático do caso.

---

#### 18. `julia_contratos_obter_detalhes`
Obtém todos os dados jurídicos e metadados de um contrato ZapSign.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "doc_token": { "type": "string", "description": "Token ZapSign do documento" }
    },
    "required": ["doc_token"]
  }
  ```
* **Retorno**: Dossiê completo do contrato: partes qualificadas, categoria do caso (`case_title`), status das assinaturas de cada signatário e link de validação pública na ZapSign.

---

#### 19. `julia_contratos_obter_link_download`
Gera o link de download direto do contrato assinado (PDF com assinaturas eletrônicas e certificado de autenticidade) ou pacote ZIP via `zapsign-file`.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "doc_token": { "type": "string", "description": "Token ZapSign do documento" }
    },
    "required": ["doc_token"]
  }
  ```

---

### Domínio 6: Filas, Canais e Roteamento

#### 20. `julia_filas_listar`
Lista todas as filas de atendimento do escritório (`queues`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "only_active": { "type": "boolean", "default": true }
    }
  }
  ```
* **Retorno**: Filas cadastradas com nome, tipo de canal (`uazapi` ou `waba`), número de WhatsApp vinculado, status de conexão e agente IA primário vinculado via `queue_agent_links`.

---

#### 21. `julia_filas_regras_roteamento`
Consulta as regras de triagem automática e distribuição de leads entre advogados (`chat_routing_rules`, `chat_agent_capacity`).
* **Argumentos**: `{}`.
* **Retorno**: Estratégia de distribuição (*round-robin*, menor carga, atendente fixo), capacidade máxima de atendimentos simultâneos por operador e status atual da equipe (*online*, *ocupado*, *ausente*).

---

### Domínio 7: Campanhas de Mensagens e Tráfego Pago

#### 22. `julia_campanhas_chat_listar`
Lista campanhas de disparos em massa de WhatsApp (`chat_campaigns`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "default": 20 }
    }
  }
  ```
* **Retorno**: Nome da campanha, público-alvo, status de agendamento/disparo, mensagens enviadas, mensagens entregues e taxa de resposta do lead.

---

#### 23. `julia_campanhas_ads_listar`
Lista os leads originados de campanhas do Meta Ads (Facebook/Instagram Ads) registrados na tabela `campaing_ads`.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "limit": { "type": "number", "default": 50 }
    }
  }
  ```
* **Retorno**: Nome da campanha do Meta Ads, anúncio de origem, criativo, formulário instantâneo e sessão do WhatsApp associada.

---

### Domínio 8: Usuários, Equipe e Permissões do Sistema

#### 24. `julia_usuarios_listar_equipe`
Lista os membros da equipe do escritório (`users`, `vw_equipe`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "only_active": { "type": "boolean", "default": true }
    }
  }
  ```
* **Retorno**: Membros da equipe com: `id`, `name`, `email`, `role` (`admin`, `advogado`, `comercial`, `colaborador`, `time`), status de atividade e agentes de IA vinculados.

---

#### 25. `julia_usuarios_obter_permissoes`
Detalha a matriz de permissões de um usuário específico (`user_permissions`).
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "user_id": { "type": "number", "description": "ID do usuário" }
    },
    "required": ["user_id"]
  }
  ```
* **Retorno**: Lista de módulos acessíveis (`chat`, `crm_leads`, `strategic_contract`, `datajud`, `advbox`) e permissões granulares (`can_view`, `can_create`, `can_edit`, `can_delete`).

---

### Domínio 9: Agentes de IA da Julia

#### 26. `julia_agentes_listar`
Lista os agentes de IA de WhatsApp configurados para o escritório (`agents`, `cod_agent`).
* **Argumentos**: `{}`.
* **Retorno**: Código do agente (`cod_agent`), nome, perfil de atuação (`SDR` / `Closer`), prompt base cadastrado, horário de atendimento e plano de leads.

---

#### 27. `julia_agentes_obter_status`
Verifica se o agente de IA está ativo ou pausado para uma conversa específica do WhatsApp.
* **Argumentos**:
  ```json
  {
    "type": "object",
    "properties": {
      "phone": { "type": "string", "description": "Número do WhatsApp do cliente" },
      "cod_agent": { "type": "string", "description": "Código do Agente" }
    },
    "required": ["phone", "cod_agent"]
  }
  ```

---

## 4. Recursos MCP (MCP Resources)

O servidor MCP expõe URIs de recursos diretos que o modelo pode ler como documentos instantâneos:

| URI do Recurso | Descrição |
|---|---|
| `julia://conversa/{conversation_id}` | Transcrição formatada e completa da conversa com áudios e dados do cliente |
| `julia://lead/{card_id}` | Ficha cadastral e comercial completa do lead no CRM |
| `julia://contrato/{doc_token}` | Dossiê e texto de resumo do contrato ZapSign |
| `julia://equipe/{client_id}` | Estrutura organizacional e lista de advogados do escritório |
| `julia://metricas/crm` | Relatório consolidado de conversão e gargalos do mês |

---

## 5. Prompts Especializados do MCP (MCP Prompts)

Prompts que ficam disponíveis para o advogado disparar no OpenClaw / Claude / ChatGPT com 1 comando:

1. **`parecer_viabilidade`**:
   - *Parâmetro*: `conversation_id`.
   - *Ação*: Executa `julia_chat_ler_mensagens` + `julia_chat_listar_arquivos` + `julia_chat_ler_conteudo_arquivo` e gera o Parecer Jurídico de Viabilidade com análise fática, fundamentação legal, riscos e pedidos estimados.
2. **`redigir_peticao_inicial`**:
   - *Parâmetro*: `conversation_id`.
   - *Ação*: Extrai os fatos do WhatsApp e documentos anexos e redige a Petição Inicial completa estruturada segundo o CPC/CLT.
3. **`auditoria_documental`**:
   - *Parâmetro*: `conversation_id`.
   - *Ação*: Lê todos os PDFs/comprovantes anexados na conversa e aponta documentos faltantes, inconsistências e cálculo de verbas.
4. **`relatorio_atendimento`**:
   - *Parâmetro*: `conversation_id`.
   - *Ação*: Gera a síntese executiva do atendimento para salvar no CRM ou enviar ao advogado titular.

---

## 6. Implementação do Servidor MCP (Código em TypeScript / Deno)

Abaixo está o esqueleto da implementação do Servidor MCP como uma **Edge Function no Supabase da Julia** (`supabase/functions/copiloto-mcp/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Autentica token MCP e resolve o client_id do escritório
async function authenticateMcpRequest(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();

  const { data: keyData } = await supabase
    .from("chat_api_keys")
    .select("client_id, user_id, is_active")
    .eq("api_key", token)
    .maybeSingle();

  if (!keyData || !keyData.is_active) return null;
  return { clientId: keyData.client_id, userId: keyData.user_id };
}

// Handlers das Ferramentas MCP
async function handleToolCall(toolName: string, args: any, auth: { clientId: string; userId: string }) {
  switch (toolName) {
    case "julia_chat_listar_conversas": {
      let query = supabase
        .from("chat_conversations")
        .select(`
          id, protocol, status, priority, channel, opened_at, last_message_at,
          chat_contacts ( id, name, phone, avatar )
        `)
        .eq("client_id", auth.clientId)
        .order("last_message_at", { ascending: false })
        .limit(args.limit || 20);

      if (args.status && args.status !== "all") query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }

    case "julia_chat_ler_mensagens": {
      const { data: msgs, error } = await supabase
        .from("chat_messages")
        .select("id, text, type, from_me, sender_name, timestamp, metadata, internal_note")
        .eq("conversation_id", args.conversation_id)
        .eq("client_id", auth.clientId)
        .order("timestamp", { ascending: true })
        .limit(args.limit || 100);

      if (error) throw error;

      return msgs.map((m) => ({
        id: m.id,
        papel: m.internal_note ? "NOTA_INTERNA" : m.from_me ? "ATENDENTE" : "CLIENTE",
        emissor: m.sender_name || (m.from_me ? "Atendente" : "Cliente"),
        tipo: m.type,
        texto: m.text,
        transcricao_audio: m.metadata?.transcription?.text || null,
        data_hora: m.timestamp,
      }));
    }

    case "julia_chat_listar_arquivos": {
      const { data: files, error } = await supabase
        .from("chat_messages")
        .select("id, type, media_url, file_name, caption, from_me, timestamp")
        .eq("conversation_id", args.conversation_id)
        .eq("client_id", auth.clientId)
        .in("type", ["document", "image", "audio", "video"])
        .not("media_url", "is", null);

      if (error) throw error;
      return files;
    }

    case "julia_chat_enviar_nota_interna": {
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: args.conversation_id,
          client_id: auth.clientId,
          type: "text",
          from_me: true,
          internal_note: true,
          note_type: args.note_type || "info",
          text: `🤖 [MCP Copiloto]: ${args.text}`,
          sender_name: "Copiloto MCP",
          timestamp: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (error) throw error;
      return { success: true, note_id: data.id };
    }

    default:
      throw new Error(`Ferramenta '${toolName}' não implementada.`);
  }
}

// Endpoint HTTP / SSE
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  const auth = await authenticateMcpRequest(req.headers.get("Authorization"));
  if (!auth) {
    return new Response(JSON.stringify({ error: "Token MCP inválido ou não autorizado" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { method, params } = await req.json();

  if (method === "tools/list") {
    // Retorna a lista de ferramentas com seus JSON Schemas
    return new Response(JSON.stringify({ tools: MCP_TOOLS_DEFINITIONS }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (method === "tools/call") {
    try {
      const result = await handleToolCall(params.name, params.arguments, auth);
      return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ isError: true, content: [{ type: "text", text: err.message }] }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not found", { status: 404 });
});
```

---

## 7. Como Conectar no OpenClaw, Claude Desktop e Cursor

### 7.1 Configuração no OpenClaw (`openclaw.json`)
```json
{
  "mcpServers": {
    "julia-adv": {
      "url": "https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/copiloto-mcp",
      "headers": {
        "Authorization": "Bearer julia_mcp_sec_987654321abcdef"
      }
    }
  }
}
```

### 7.2 Configuração no Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "julia-juridico": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-fetch",
        "https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/copiloto-mcp",
        "--header",
        "Authorization=Bearer julia_mcp_sec_987654321abcdef"
      ]
    }
  }
}
```

---

## 8. Exemplos Práticos de Interação com a IA no OpenClaw

### Exemplo 1: Análise de Caso com WhatsApp + Documentos
> **Usuário no OpenClaw**: *"OpenClaw, analise a conversa do lead Carlos Eduardo no WhatsApp da Julia, leia os holerites enviados em anexo e me dê um parecer de viabilidade para rescisão indireta."*

* **Ações automáticas do MCP**:
  1. Chama `julia_contatos_buscar(query="Carlos Eduardo")` → Obtém `contact_id` e `conversation_id`.
  2. Chama `julia_chat_ler_mensagens(conversation_id="...")` → Lê todo o histórico e áudios transcritos.
  3. Chama `julia_chat_listar_arquivos(conversation_id="...")` → Identifica `holerite_marco_2026.pdf`.
  4. Chama `julia_chat_ler_conteudo_arquivo(message_id="...")` → Extrai os valores de salário e descontos.
  5. Gera o Parecer de Viabilidade detalhado com cálculo de verbas e fundamentação no art. 483 da CLT.

---

### Exemplo 2: Auditoria de Contratos ZapSign do Dia
> **Usuário no OpenClaw**: *"Quais contratos ZapSign foram assinados hoje na Julia? Me liste os nomes, o advogado responsável e o resumo do caso."*

* **Ações automáticas do MCP**:
  1. Chama `julia_contratos_listar(status_document="SIGNED")`.
  2. Cruza com `julia_usuarios_listar_equipe()` para identificar os advogados responsáveis.
  3. Retorna a lista organizada com links diretos para download do contrato assinado.

---

## 9. Conclusão e Próximos Passos

A criação do servidor **Julia MCP** transforma a Julia em um **Hub de Inteligência Jurídica Universal**. O advogado utiliza as contas e ferramentas que mais gosta (OpenClaw, Claude Pro, ChatGPT Pro, Cursor) com **zero custo de API adicional** e com **acesso completo e em tempo real a todo o banco de dados operacional da Julia**.
