# Arquitetura de Integração: Julia ↔ Contas ChatGPT Pro, Gemini Pro e Claude Pro via Autenticação (Auth / Session)

Este documento detalha a arquitetura técnica, engenharia de autenticação, pipeline de dados e interface para integrar o sistema **Julia** (SaaS jurídico multi-tenant desenvolvido em React/Vite/Tailwind e Supabase Edge Functions / Postgres duplo) com **contas de chat convencionais e assinaturas Pro/Advanced** (ChatGPT Plus/Pro/Team, Gemini Advanced/Google One AI e Claude Pro/Team), **sem utilizar APIs pagas por token**, aproveitando a autenticação e sessões de usuário.

---

## 1. Visão Geral e Motivação

### 1.1 Cenário Atual vs Nova Arquitetura
* **Modelo Atual da Julia**: Utiliza o gateway de IA (`supabase/functions/_shared/aiGateway.ts`) com modelos rápidos e econômicos (Gemini 2.5 Flash / 3 Flash Preview / OpenRouter), cobrando ou consumindo tokens de API por requisição.
* **Nova Arquitetura Pro (Auth-Based)**: Permite que o advogado ou escritório conecte sua **assinatura Pro pessoal ou corporativa** (ChatGPT Pro com GPT-4o / o1 / o3-mini, Claude 3.7 Sonnet / Opus com extended thinking, Gemini 1.5/2.0 Pro com janela de contexto de 1M-2M tokens) diretamente à interface de atendimento e CRM da Julia.

### 1.2 Objetivos Funcionais
1. **Análise Completa de Conversas de Leads**: Leitura de todo o histórico do WhatsApp/uazapi/WABA, transcrições de áudio e notas internas.
2. **Leitura e Extração de Documentos**: Processamento de PDFs, imagens de comprovantes, laudos, contratos e certidões anexadas na conversa.
3. **Elaboração de Peças Jurídicas de Alta Complexidade**: Petições Iniciais, Contestações, Recursos, Réplicas e Notificações Extrajudiciais completas e fundamentadas.
4. **Pareceres Jurídicos e Análise de Viabilidade**: Diagnóstico de probabilidade de êxito, prescrição/decadência, valor da causa estimado e estratégia processual.
5. **Relatórios Executivos de Atendimento**: Síntese estruturada para advogados seniores ou clientes.

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           WORKSPACE DA JULIA (Lovable)                         │
│                                                                                │
│  ┌───────────────────────┐   ┌───────────────────────┐   ┌──────────────────┐  │
│  │   Inbox / WhatsApp    │   │  CRM Leads / Cards    │   │  Docs / Anexos   │  │
│  │   (chat_messages)     │   │(crm_atendimento_cards)│   │ (Supabase Media) │  │
│  └───────────┬───────────┘   └───────────┬───────────┘   └────────┬─────────┘  │
│              │                           │                        │            │
│              └───────────────────┬───────┴────────────────────────┘            │
│                                  │                                             │
│                                  ▼                                             │
│             ┌──────────────────────────────────────────────┐                   │
│             │    Copiloto Jurídico Pro (Aba ChatRightBar)   │                   │
│             │    - Seletor de Modelo (ChatGPT/Gemini/Claude│                   │
│             │    - Prompt Engineering Jurídico Dinâmico    │                   │
│             └────────────────────┬─────────────────────────┘                   │
└──────────────────────────────────┼─────────────────────────────────────────────┘
                                   │
       ┌───────────────────────────┴───────────────────────────┐
       ▼                                                       ▼
┌───────────────────────────────┐               ┌───────────────────────────────┐
│  MÉTODO A: EXTENSÃO JULIA     │               │  MÉTODO B: HEADLESS DAEMON    │
│  (Companion Extension Bridge) │               │  (Local/Self-Hosted Bridge)   │
│  • Usa sessão ativa no browser│               │  • Puppeteer/Playwright Stealth│
│  • Bypassa Cloudflare/reCAPTCHA│              │  • Gestão de Sessões em Fila  │
│  • Upload nativo de PDFs/Docs │               │  • Processamento em Background│
└──────────────┬────────────────┘               └───────────────┬───────────────┘
               │                                                │
               └───────────────────┬────────────────────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   ChatGPT Pro   │       │   Claude Pro    │       │   Gemini Pro    │
│ (chatgpt.com)   │       │  (claude.ai)    │       │  (gemini.google)│
│  GPT-4o / o1    │       │ Sonnet / Opus   │       │ Context 2M      │
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

---

## 2. Estratégias de Autenticação para Contas Web (Não-API)

Contas web comuns (ChatGPT, Gemini, Claude) utilizam mecanismos de autenticação com cookies de sessão, tokens de autorização temporários (NextAuth, Bearer JWT rotativo, tokens de validação de bot Cloudflare/reCAPTCHA e Proof-of-Work).

Abaixo estão os 3 padrões arquiteturais viáveis, com foco na solução recomendada para o ecossistema Lovable da Julia.

---

### 2.1 Padrão 1 (Recomendado): Extensão "Julia AI Companion" (Web Bridge)

A solução mais estável, segura e livre de bloqueios anti-bot é uma **Extensão de Navegador (Chrome/Edge)** que atua como ponte segura entre a aplicação Julia e as abas ativas do advogado no ChatGPT, Claude ou Gemini.

#### Como Funciona:
1. O advogado instala a extensão oficial da Julia e faz login nas abas normais: `chatgpt.com`, `claude.ai` e `gemini.google.com`.
2. A extensão roda em segundo plano e expõe uma API de mensageria segura para a origem da Julia (`https://*.lovable.app` ou domínio do escritório).
3. Quando o usuário clica em **"Gerar Petição Inicial com ChatGPT Pro"** ou **"Analisar Caso com Claude Pro"** dentro do chat da Julia:
   - A Julia reúne o histórico do lead + transcrições + links de documentos anexos.
   - A Julia dispara um evento `window.postMessage` para a extensão.
   - A extensão executa a requisição autenticada dentro da sessão ativa da respectiva aba (via `fetch` com as credenciais nativas ou via injeção DOM controlada).
   - O streaming da resposta é capturado em tempo real e devolvido à interface da Julia via eventos de streaming.

#### Vantagens:
* **Zero Risco de Bloqueio**: Utiliza o IP e fingerprint real do navegador do advogado (não cai em Cloudflare Turnstile nem reCAPTCHA).
* **Upload Nativo de Documentos**: A extensão pode anexar arquivos diretamente no endpoint interno de upload do ChatGPT/Claude/Gemini, permitindo que os modelos leiam PDFs inteiros com OCR nativo.
* **Segurança Total**: Nenhuma senha ou cookie de sessão do usuário é enviado para o banco de dados da Julia.

---

### 2.2 Padrão 2: Desktop Bridge / Sidecar Local (App Electron/Tauri/Node)

Para escritórios que preferem uma aplicação executável rodando na máquina:
* Um serviço local leve (`localhost:57218`) executando um navegador headless com perfil de usuário persistente.
* A Julia (no navegador) faz chamadas HTTP/WebSocket para o localhost.
* Suporta fila de análises pesadas em lote (ex: analisar 20 leads e gerar pareceres durante a noite).

---

### 2.3 Padrão 3: Self-Hosted Docker Headless Relay (Playwright Stealth / Reverse Proxy)

Para escritórios que desejam centralizar o acesso a uma conta Pro compartilhada em um servidor VPS do escritório:
* Contêiner Docker rodando `Playwright Chromium Stealth` com perfil persistente.
* Login inicial feito uma única vez via VNC ou tela de autenticação interativa.
* Exposição de endpoint interno `POST /v1/chat/completions` compatível, onde a Edge Function do Supabase da Julia pode bater.

---

## 3. Protocolos de Autenticação e Sessão por Provedor

### 3.1 ChatGPT Plus / Pro (`chatgpt.com`)

| Item | Especificação |
|---|---|
| **Tipo de Sessão** | Cookie `__Secure-next-auth.session-token` + Bearer Token efêmero |
| **Endpoint de Sessão** | `GET https://chatgpt.com/api/auth/session` (retorna `accessToken` válido por ~1 hora) |
| **Endpoint de Conversação** | `POST https://chatgpt.com/backend-anon/conversation` ou `POST https://chatgpt.com/backend-api/conversation` |
| **Cabeçalhos Exigidos** | `Authorization: Bearer <accessToken>`, `oai-device-id`, `oai-language`, `baggage` |
| **Modelos Pro** | `gpt-4o`, `o1`, `o1-pro`, `o3-mini`, `gpt-4.5` |
| **Upload de Anexos** | `POST https://chatgpt.com/backend-api/files` (retorna `file_id` para vincular à mensagem) |

#### Estrutura do Payload de Envio (ChatGPT Web):
```json
{
  "action": "next",
  "messages": [
    {
      "id": "uuid-v4-msg",
      "author": { "role": "user" },
      "content": {
        "content_type": "text",
        "parts": ["Texto com histórico do lead + solicitação jurídica"]
      },
      "metadata": {
        "attachments": [
          { "file_id": "file-xyz123", "size": 1048576, "name": "procuracao_assinada.pdf" }
        ]
      }
    }
  ],
  "model": "gpt-4o",
  "parent_message_id": "uuid-v4-parent",
  "timezone_offset_min": 180,
  "suggestions": []
}
```

---

### 3.2 Claude Pro / Team (`claude.ai`)

| Item | Especificação |
|---|---|
| **Tipo de Sessão** | Cookie `sessionKey` (`sk-ant-sid01-...`) |
| **Endpoint de Organizações** | `GET https://claude.ai/api/organizations` (recupera `org_id`) |
| **Endpoint de Conversação** | `POST https://claude.ai/api/organizations/{org_id}/chat_conversations/{chat_id}/completion` |
| **Cabeçalhos Exigidos** | `Cookie: sessionKey=...`, `User-Agent` de browser real, `Accept: text/event-stream` |
| **Modelos Pro** | `claude-3-7-sonnet-20250219`, `claude-3-5-sonnet`, `claude-3-opus` |
| **Upload de Documentos** | `POST https://claude.ai/api/organizations/{org_id}/upload` (Multipart com PDF/DOCX) |

#### Vantagem Especial para Direito:
O Claude Pro possui excelente capacidade de raciocínio com *Extended Thinking* e preserva precisão técnica em jurisprudência, estrutura de teses do CPC/CPP e formatação de peças.

---

### 3.3 Gemini Advanced / Pro (`gemini.google.com`)

| Item | Especificação |
|---|---|
| **Tipo de Sessão** | Cookies de Conta Google: `__Secure-1PSID`, `__Secure-1PSIDTS`, `__Secure-1PSIDCC`, `SSID` |
| **Endpoint Interno** | `POST https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate` |
| **Parâmetros de Autenticação** | Token `SNlM0e` (extraído do script inicial `window.WIZ_global_data`), token `at` |
| **Modelos** | Gemini 2.0 Pro / Flash com janela de até 2 milhões de tokens |
| **Vantagem Especial** | Capacidade de ler processos completos de centenas de páginas em segundos sem estourar limite de contexto. |

---

## 4. Pipeline de Dados da Julia: Do Lead à Peça Jurídica

Para que a IA Pro consiga atuar como um advogado especialista, a Julia precisa reunir e orquestrar múltiplos dados do ecossistema existente.

### 4.1 Dados Agregados pela Julia

```
┌────────────────────────────────────────────────────────────────────────┐
│                        COMPILADOR DE CONTEXTO                          │
│                                                                        │
│  1. DADOS CADASTRAIS (chat_contacts / crm_atendimento_cards):          │
│     - Nome completo, WhatsApp, e-mail, CPF (se houver)                 │
│     - Tags ativas (ex: "Trabalhista", "Direito Bancário", "Urgente")   │
│     - Fase do funil / Status do contrato                               │
│                                                                        │
│  2. HISTÓRICO DE MENSAGENS (chat_messages):                            │
│     - Mensagens de texto ordenadas cronologicamente                    │
│     - Transcrições automáticas de áudios (chat-transcribe-audio)       │
│     - Notas internas adicionadas pela equipe jurídica                  │
│                                                                        │
│  3. DOCUMENTOS E ANEXOS:                                               │
│     - Documentos baixados do WhatsApp (chat-media-download / Storage)  │
│     - PDFs de comprovantes, holerites, extratos, contratos ZapSign     │
│                                                                        │
│  4. DIRETRIZES DO ESCRITÓRIO:                                         │
│     - Identificação da OAB do advogado responsável                     │
│     - Foro / Comarca de atuação                                        │
│     - Estilo de redação (conciso, aprofundado, com jurisprudência)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Formato da Transcrição Estruturada para a IA

A Julia processa o histórico em um formato limpo e sem poluição de metadados técnicos:

```text
=== CONTEXTO DO ATENDIMENTO JURÍDICO ===
CLIENTE: Carlos Eduardo da Silva
TELEFONE: +55 (11) 98765-4321
RAMO DO DIREITO: Trabalhista / Rescisão Indireta
ADVOGADO RESPONSÁVEL: Dr. Marcos Vinicius (OAB/SP 123.456)
DATA DO PRIMEIRO CONTATO: 14/05/2026

=== HISTÓRICO CRONOLÓGICO DA CONVERSA ===
[14/05/2026 14:02] [CLIENTE]: Boa tarde, preciso de ajuda com a empresa onde trabalho.
[14/05/2026 14:03] [JULIA - BOT]: Olá Carlos! Como posso ajudar você hoje?
[14/05/2026 14:05] [CLIENTE] (áudio transcrito): Trabalho há 3 anos como operador de máquinas, sem registro em carteira. Desde janeiro não recebo salário em dia e sofri um acidente leve no mês passado sem emissão de CAT.
[14/05/2026 14:10] [ADVOGADO (Dr. Marcos)]: Carlos, você possui extratos bancários com os depósitos e fotos do local de trabalho?
[14/05/2026 14:12] [CLIENTE] (anexo: extrato_bancario_2026.pdf): Enviei o extrato comprovando que os depósitos vinham do CNPJ da empresa.

=== DOCUMENTOS ANEXADOS DISPONÍVEIS ===
1. extrato_bancario_2026.pdf (Comprovante de vínculo empregatício e depósitos esparsos)
2. foto_atestado_medico.jpeg (Atendimento de primeiros socorros pós-acidente)
```

---

## 5. Casos de Uso Implementados no Chat da Julia

### 5.1 Caso de Uso 1: Analisador de Viabilidade e Parecer Jurídico
* **Objetivo**: Avaliar se o relato do lead tem fundamento fático e jurídico viável para propositura de ação ou acordo.
* **Saída Gerada**:
  - Resumo dos Fatos Relevantes.
  - Enquadramento Legal e Teses Aplicáveis (Leis, CLT/CC/CDC, Súmulas TST/STJ/STF).
  - Análise de Riscos, Ônus da Prova e Documentos Faltantes.
  - Estimativa de Valores e Pedidos Viáveis.
  - Recomendação Prática (Ex: "Ação de Rescisão Indireta c/c Indenizatória por Acidente").

### 5.2 Caso de Uso 2: Redator de Peças Jurídicas (Petição Inicial, Notificação, Recurso)
* **Objetivo**: Redigir a peça processual completa com qualificação das partes, dos fatos, do direito, jurisprudência recente e rol de pedidos com liquidação estimada.
* **Diferencial com Contas Pro**:
  - ChatGPT Pro (o1/o3-mini): Cria argumentação lógica rigorosa e cálculos de verbas trabalhistas/rescisórias.
  - Claude 3.7 Pro: Redige peças elegantes, fluídas, com citações doutrinárias e formatação jurídica impecável.
  - Gemini 2.0 Pro: Lê petições iniciais de 80 páginas da parte contrária e gera a Contestação ponto a ponto.

### 5.3 Caso de Uso 3: Leitor e Auditor de Documentos do Lead
* **Objetivo**: O cliente manda pelo WhatsApp fotos de extratos bancários, contratos de empréstimo consignado ou laudos médicos.
* **Processamento**: A IA Pro analisa as imagens/PDFs e extrai:
  - Taxas de juros abusivas em contratos bancários.
  - Inconsistências em rescisões e depósitos de FGTS.
  - Nexo de causalidade em laudos médicos/doenças ocupacionais.

### 5.4 Caso de Uso 4: Relatório de Atendimento e Prontuário do Lead
* **Objetivo**: Criar uma síntese executiva pronta para ser anexada ao card do CRM Builder ou Advbox, informando a situação atual do cliente e próximos passos da equipe.

---

## 6. Arquitetura de Interface e UX no Lovable (Frontend da Julia)

### 6.1 Localização e Componentes na Interface
1. **Nova Aba no Painel Direito do Chat (`ChatRightBar.tsx`)**:
   - Adicionar a aba **"Copiloto Pro"** ao lado de `Contato`, `CRM`, `Lead` e `Telefonia`.
   - Componente: `src/components/chat/CopilotProPanel.tsx`.
2. **Menu de Ações Rápidas no Header da Conversa (`ChatHeader.tsx`)**:
   - Botão com ícone de IA com dropdown:
     - 📋 *Resumir Atendimento*
     - ⚖️ *Parecer de Viabilidade*
     - 📝 *Gerar Petição Inicial*
     - 📑 *Auditar Documentos Anexos*
     - 💬 *Chat Livre com a Conta Pro*
3. **Editor e Visualizador de Peças com Exportação (`LegalDocumentModal.tsx`)**:
   - Visualização em Markdown enriquecido.
   - Botões: *Copiar Texto*, *Baixar em .DOCX / .PDF*, *Salvar como Nota Interna na Conversa*, *Vincular ao Deal do CRM*.

### 6.2 Seletor de Modelo e Status de Conexão

```
┌────────────────────────────────────────────────────────┐
│  🤖 COPILOTO JURÍDICO PRO                              │
│                                                        │
│  Provedor Conectado:                                   │
│  [ ● ChatGPT Pro (GPT-4o / o1)               ▼ ]       │
│  Status: Conectado via Julia Extension (Sessão Ativa)  │
├────────────────────────────────────────────────────────┤
│  AÇÕES RÁPIDAS COM ESTE LEAD:                          │
│  [ ⚖️ Parecer ] [ 📝 Petição ] [ 🔍 Auditar Docs ]     │
├────────────────────────────────────────────────────────┤
│  MENSAGEM / INSTRUÇÃO CUSTOMIZADA:                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Ex: "Redija uma notificação extrajudicial para   │  │
│  │ o empregador dando prazo de 5 dias..."           │  │
│  └──────────────────────────────────────────────────┘  │
│  [x] Incluir histórico do WhatsApp (38 mensagens)      │
│  [x] Anexar 2 documentos recebidos do cliente          │
│                                                        │
│  [        GERAR DOCUMENTO COM CHATGPT PRO        ]     │
└────────────────────────────────────────────────────────┘
```

---

## 7. Estrutura de Comunicação da Extensão Julia Companion

### 7.1 Manifesto da Extensão (`manifest.json` - MV3)

```json
{
  "manifest_version": 3,
  "name": "Julia AI Companion - Jurídico Pro",
  "version": "1.0.0",
  "description": "Integração segura entre a Julia e contas ChatGPT Pro, Claude Pro e Gemini Pro.",
  "permissions": [
    "cookies",
    "storage",
    "tabs",
    "scripting"
  ],
  "host_permissions": [
    "https://*.lovable.app/*",
    "https://app.julia.adv.br/*",
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://*.lovable.app/*", "https://app.julia.adv.br/*"],
      "js": ["content-bridge.js"]
    }
  ]
}
```

### 7.2 Fluxo de Mensagens entre Frontend Julia e Extensão

1. **Checagem de Status da Extensão no React (`useJuliaAICompanion.ts`)**:
```typescript
import { useState, useEffect } from 'react';

export interface CompanionStatus {
  isInstalled: boolean;
  chatgpt: { loggedIn: boolean; plan: 'free' | 'plus' | 'pro' | 'unknown' };
  claude: { loggedIn: boolean; plan: 'free' | 'pro' | 'team' | 'unknown' };
  gemini: { loggedIn: boolean; plan: 'free' | 'advanced' | 'unknown' };
}

export function useJuliaAICompanion() {
  const [status, setStatus] = useState<CompanionStatus>({
    isInstalled: false,
    chatgpt: { loggedIn: false, plan: 'unknown' },
    claude: { loggedIn: false, plan: 'unknown' },
    gemini: { loggedIn: false, plan: 'unknown' },
  });

  useEffect(() => {
    // Escuta resposta da extensão
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source === 'JULIA_COMPANION_RESPONSE') {
        if (event.data.type === 'STATUS_RESULT') {
          setStatus({ isInstalled: true, ...event.data.payload });
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Consulta status
    window.postMessage({ source: 'JULIA_WEB_APP', type: 'CHECK_STATUS' }, '*');

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const executePrompt = async (params: {
    provider: 'chatgpt' | 'claude' | 'gemini';
    model?: string;
    prompt: string;
    attachments?: Array<{ url: string; name: string; type: string }>;
    onChunk: (chunk: string) => void;
  }): Promise<string> => {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const listener = (event: MessageEvent) => {
        if (event.data?.source === 'JULIA_COMPANION_RESPONSE' && event.data.requestId === requestId) {
          if (event.data.type === 'STREAM_CHUNK') {
            params.onChunk(event.data.chunk);
          } else if (event.data.type === 'STREAM_COMPLETE') {
            window.removeEventListener('message', listener);
            resolve(event.data.fullText);
          } else if (event.data.type === 'ERROR') {
            window.removeEventListener('message', listener);
            reject(new Error(event.data.error));
          }
        }
      };

      window.addEventListener('message', listener);

      window.postMessage({
        source: 'JULIA_WEB_APP',
        type: 'EXECUTE_PROMPT',
        requestId,
        payload: params,
      }, '*');
    });
  };

  return { status, executePrompt };
}
```

---

## 8. Biblioteca de Prompts Jurídicos Especializados

Para garantir que a resposta gerada com a conta Pro seja de padrão profissional de escritório de advocacia, a Julia utiliza templates prontos:

### 8.1 Template: Parecer e Análise de Caso
```markdown
Você é um consultor jurídico sênior especializado em Direito [ÁREA_DO_DIREITO].
Analise a conversa de atendimento e os documentos do lead abaixo.

Gere um Parecer Jurídico de Viabilidade estruturado rigorosamente em:
1. IDENTIFICAÇÃO DO CASO E PARTES
2. SÍNTESE FÁTICA DETALHADA (extraída da conversa e documentos)
3. ENQUADRAMENTO JURÍDICO E FUNDAMENTAÇÃO LEGAL (artigos de lei e jurisprudência dominante)
4. ANÁLISE DE VIABILIDADE E RISCOS (prescrição, decadência, ônus probatório, pontos frágeis)
5. ESTIMATIVA DE PEDIDOS E VALORES VIÁVEIS
6. PRÓXIMOS PASSOS E DOCUMENTAÇÃO COMPLEMENTAR NECESSÁRIA

Histórico do Atendimento:
[HISTORICO_FORMATADO]
```

### 8.2 Template: Petição Inicial Completa
```markdown
Você é um advogado especialista em redação processual civil/trabalhista.
Com base no histórico fático e documentos fornecidos, redija a PETIÇÃO INICIAL completa, pronta para protocolo.

Requisitos obrigatórios:
- Endereçamento ao juízo competente da comarca aplicável
- Qualificação completa das partes com marcadores para dados ausentes
- Dos Fatos com exposição cronológica clara
- Do Direito com tópicos individualizados por pedido
- Da Tutela de Urgência (se houver elementos fáticos para tal)
- Da Gratuidade da Justiça
- Do Pedido e Requerimentos com liquidação estimada e fechamento com valor da causa e data.

Dados do Atendimento e Documentos:
[HISTORICO_FORMATADO]
```

---

## 9. Segurança, LGPD e Mitigação de Limites de Uso

### 9.1 Sigilo Advocatício e LGPD
* **Anonimização Opcional**: Possibilidade de ofuscar dados ultra-sensíveis (CPF, RG, endereço) antes do envio, se configurado pelo escritório.
* **Isolamento de Tenant**: As requisições executadas no navegador do usuário herdam estritamente as permissões do `client_id` e do `user_id` autenticado na Julia.
* **Armazenamento de Peças**: A peça gerada é salva como rascunho em `chat_conversation_summaries` ou tabela própria `legal_documents` no Supabase do escritório, nunca exposta externamente.

### 9.2 Gestão de Rate Limits de Contas Pro
* **ChatGPT Plus/Pro**: ~40 a 80 mensagens a cada 3 horas no GPT-4o (ilimitado no modo padrão Pro; limites em modelos de raciocínio como o1/o1-pro).
* **Claude Pro**: Limite baseado no tamanho do contexto enviado por janela de horas.
* **Estratégia de Otimização**:
  - Resumir o histórico inicial antes de enviar conversas com mais de 500 mensagens.
  - Enviar documentos em PDF diretamente através do endpoint nativo de upload em vez de colar texto bruto de centenas de páginas, economizando a janela de contexto.

---

## 10. Roteiro de Implementação Sugerido para o Projeto

| Etapa | Tarefa | Local no Código |
|---|---|---|
| **Fase 1** | Criação do pacote da extensão de navegador `julia-companion-extension/` | `/packages/julia-companion/` |
| **Fase 2** | Hook de comunicação e detecção de contas ativas (`useJuliaAICompanion`) | `src/hooks/useJuliaAICompanion.ts` |
| **Fase 3** | Componente de Copiloto Pro na barra lateral do Chat | `src/components/chat/CopilotProPanel.tsx` e registro no `ChatRightBar.tsx` |
| **Fase 4** | Modal e Drawer de Geração e Exportação de Peças Jurídicas | `src/components/chat/LegalDocumentGeneratorDialog.tsx` |
| **Fase 5** | Conexão com documentos e mídias do lead (`chat_messages.media_url`) | `src/lib/chat/leadContextCompiler.ts` |
| **Fase 6** | Botão de atalho nos cards de leads do CRM | `src/pages/crm/components/CRMLeadDetailsDialog.tsx` |

---

## 11. Conclusão

Esta arquitetura viabiliza o uso pleno do poder dos maiores modelos de linguagem do mundo (ChatGPT Pro, Claude Pro e Gemini Advanced) dentro do fluxo de trabalho diário da Julia, **sem gerar faturas por token de API**, aproveitando as assinaturas que os escritórios e advogados já pagam mensalmente, com total conformidade técnica, facilidade de uso e alta produtividade jurídica.
