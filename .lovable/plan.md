
# Plano: Monitoramento de Processos com Alertas via WhatsApp

## Visao Geral

Adicionar ao modulo DataJud um sistema completo de monitoramento de processos judiciais com tres abas: **Busca** (existente), **Monitoramento** e **Configuracoes**. O sistema verifica periodicamente movimentacoes nos processos e envia alertas na plataforma e via WhatsApp usando as conexoes UaZapi dos agentes do usuario.

---

## Estrutura de Abas

```text
/datajud
  +-- [Busca]  (atual - SearchTab)
  +-- [Monitoramento]  (novo - MonitoringTab)
  +-- [Configuracoes]  (novo - SettingsTab)
```

---

## 1. Banco de Dados (Supabase)

### Tabela: datajud_monitored_processes

Armazena cada processo sendo monitorado.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador unico |
| user_id | integer | ID do usuario que adicionou |
| process_number | text | Numero do processo (apenas digitos) |
| process_number_formatted | text | Numero formatado (CNJ) |
| name | text | Nome identificador (ex: "Joazinho trinta") |
| client_phone | text | Telefone do cliente para notificacao (nullable) |
| tribunal | text | Sigla do tribunal (ex: TJSP) |
| last_known_movements | jsonb | Ultimas movimentacoes conhecidas |
| last_check_at | timestamptz | Ultima verificacao |
| status | text | active / paused / error |
| created_at | timestamptz | Data de criacao |
| updated_at | timestamptz | Data de atualizacao |

### Tabela: datajud_notification_config

Configuracao global de notificacoes do usuario.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador unico |
| user_id | integer | ID do usuario |
| default_agent_cod | text | Cod do agente padrao para envio |
| office_phones | text[] | Numeros do escritorio para receber alertas |
| is_active | boolean | Se notificacoes estao ativas |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### Tabela: datajud_alerts

Historico de alertas gerados.

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid (PK) | Identificador unico |
| process_id | uuid (FK) | Referencia ao processo monitorado |
| user_id | integer | ID do usuario |
| movement_data | jsonb | Dados da movimentacao detectada |
| is_read | boolean | Se o alerta foi lido na plataforma |
| whatsapp_sent | boolean | Se foi enviado via WhatsApp |
| whatsapp_error | text | Erro no envio, se houver |
| created_at | timestamptz | |

RLS: Todas as tabelas com `true` (mesmo padrao das tabelas CRM existentes).

Realtime habilitado em `datajud_alerts` para notificacoes em tempo real na plataforma.

---

## 2. Frontend - Componentes

### 2.1 Pagina Principal Refatorada

Converter `DataJudSearchPage.tsx` para usar `Tabs` do Radix UI com tres abas:

- **Busca**: Conteudo atual, com botao "Monitorar" no `ProcessCard`
- **Monitoramento**: Lista de processos monitorados + importacao em lote
- **Configuracoes**: Configuracao de conexao e numeros de notificacao

### 2.2 Aba Monitoramento (MonitoringTab)

**Funcionalidades:**
- Lista de processos monitorados com status (ativo/pausado/erro)
- Botao para adicionar processo individual (numero + nome + telefone)
- Importacao em lote via:
  - **Campo de texto**: Uma linha por processo no formato `numero_processo, nome, telefone`
  - **Upload de planilha**: CSV/XLSX com colunas: numero_processo, nome, telefone
- Validacao de cada numero de processo (20 digitos, formato CNJ)
- Acoes por processo: pausar, remover, ver historico de alertas
- Badge com total de alertas nao lidos

**Componentes a criar:**
```text
src/pages/datajud/
  components/
    MonitoringTab.tsx           # Aba principal de monitoramento
    MonitoredProcessList.tsx    # Lista de processos monitorados
    AddProcessDialog.tsx        # Dialog para adicionar 1 processo
    BulkImportDialog.tsx        # Dialog para importacao em lote
    ProcessAlertsBadge.tsx      # Badge de alertas nao lidos
    AlertsPanel.tsx             # Painel de alertas recentes
  hooks/
    useMonitoredProcesses.ts    # CRUD de processos monitorados
    useProcessAlerts.ts         # Consulta e gerencia alertas
```

### 2.3 Aba Configuracoes (SettingsTab)

**Funcionalidades:**
- Selecao da conexao padrao de envio (dropdown com agentes ativos do usuario via `useMyAgents`)
- Lista de numeros do escritorio para receber notificacoes
- Input com mascara de telefone para adicionar numeros
- Toggle para ativar/desativar notificacoes

**Componentes a criar:**
```text
src/pages/datajud/
  components/
    SettingsTab.tsx             # Aba de configuracoes
    AgentConnectionSelect.tsx   # Seletor de conexao do agente
    OfficePhonesList.tsx        # Lista de telefones do escritorio
  hooks/
    useNotificationConfig.ts    # CRUD da configuracao
```

### 2.4 Botao "Monitorar" na Busca

Ao visualizar resultados ou detalhes de um processo, botao "Monitorar" que abre dialog para:
- Nome do processo (campo texto)
- Telefone do cliente (campo com mascara, opcional)
- Confirmacao

---

## 3. Edge Function: datajud-monitor

Nova Edge Function para verificacao periodica de movimentacoes.

**Logica:**
1. Buscar todos os processos monitorados com status `active`
2. Para cada processo, consultar a API DataJud no tribunal correto
3. Comparar movimentacoes atuais com `last_known_movements`
4. Se houver novas movimentacoes:
   - Criar registro em `datajud_alerts`
   - Atualizar `last_known_movements` no processo
   - Enviar notificacao via WhatsApp (UaZapi) para:
     - Numeros do escritorio (da config)
     - Telefone do cliente (do processo, se configurado)
5. Atualizar `last_check_at`

**Envio WhatsApp:**
- Buscar dados de conexao do agente padrao (evo_url, evo_apikey, evo_instance) via tabela de agentes no banco externo
- Chamar diretamente a API da UaZapi (Evolution API) a partir da Edge Function, sem passar pelo uazapi-proxy (que e restrito ao frontend)
- Endpoint: `POST {evo_url}/message/sendText/{instance}`
- Header: `apikey: {evo_apikey}`

**Mensagem modelo:**
```text
*Nova Movimentacao Processual*

Processo: {process_number_formatted}
Nome: {name}
Tribunal: {tribunal}

Movimentacao: {movement_name}
Data: {movement_date}

--
Alerta automatico - Busca Processual Julia
```

### Agendamento (pg_cron)

Executar a Edge Function a cada 6 horas via `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'datajud-monitor-check',
  '0 */6 * * *',
  $$ select net.http_post(...) $$
);
```

---

## 4. Validacao de Processos na Importacao em Lote

### Formato do campo de texto:
```text
00100747420265150062, Joazinho trinta, 5534988860163
00100747420265150063, Maria Silva, 5534988860164
```

Cada linha: `numero_processo, nome, telefone_notificacao`

### Validacao:
- Numero do processo: aceita com ou sem formatacao, validado como 20 digitos apos remover caracteres nao numericos
- Nome: obrigatorio, texto livre
- Telefone: opcional, se presente deve ter formato internacional (55 + DDD + numero)
- Linhas em branco sao ignoradas
- Preview de validacao antes de confirmar (tabela mostrando valido/invalido por linha)

### Upload de planilha:
- Aceita CSV e XLSX (parse no frontend usando FileReader para CSV)
- Mesmas 3 colunas: numero_processo, nome, telefone
- Mesmo preview de validacao

---

## 5. Alertas na Plataforma

### Badge no menu
- Indicador numerico de alertas nao lidos no menu lateral (item DataJud)

### Painel de alertas
- Na aba Monitoramento, secao superior com alertas recentes
- Cada alerta mostra: processo, movimentacao, data, status do envio WhatsApp
- Botao para marcar como lido
- Realtime via Supabase para atualizar automaticamente

---

## 6. Arquivos a Criar/Modificar

### Novos arquivos:
```text
src/pages/datajud/components/MonitoringTab.tsx
src/pages/datajud/components/MonitoredProcessList.tsx
src/pages/datajud/components/AddProcessDialog.tsx
src/pages/datajud/components/BulkImportDialog.tsx
src/pages/datajud/components/AlertsPanel.tsx
src/pages/datajud/components/SettingsTab.tsx
src/pages/datajud/components/AgentConnectionSelect.tsx
src/pages/datajud/components/OfficePhonesList.tsx
src/pages/datajud/hooks/useMonitoredProcesses.ts
src/pages/datajud/hooks/useProcessAlerts.ts
src/pages/datajud/hooks/useNotificationConfig.ts
supabase/functions/datajud-monitor/index.ts
```

### Arquivos modificados:
```text
src/pages/datajud/DataJudSearchPage.tsx  -- Refatorar para Tabs
src/pages/datajud/components/ProcessCard.tsx  -- Adicionar botao "Monitorar"
src/pages/datajud/components/ProcessDetailsSheet.tsx  -- Adicionar botao "Monitorar"
src/pages/datajud/types.ts  -- Novos tipos
supabase/config.toml  -- Nova function datajud-monitor
```

---

## 7. Fluxo do Usuario

### Adicionar processo pela busca:
1. Buscar processo por numero na aba Busca
2. Nos resultados, clicar "Monitorar" no card
3. Dialog abre com numero ja preenchido
4. Informar nome e telefone do cliente (opcional)
5. Confirmar - processo adicionado a lista de monitoramento

### Importar lista em lote:
1. Ir para aba Monitoramento
2. Clicar "Importar Lista"
3. Colar texto ou fazer upload de planilha
4. Sistema valida cada linha e mostra preview
5. Confirmar - processos validos sao adicionados

### Configurar notificacoes:
1. Ir para aba Configuracoes
2. Selecionar conexao padrao (agente com WhatsApp ativo)
3. Adicionar numeros do escritorio
4. Ativar notificacoes

### Receber alerta:
1. Sistema verifica movimentacoes a cada 6 horas
2. Nova movimentacao detectada:
   - Alerta aparece na plataforma (aba Monitoramento)
   - WhatsApp enviado para numeros do escritorio
   - WhatsApp enviado para telefone do cliente (se configurado)

---

## 8. Etapas de Implementacao

1. **Banco de Dados**: Criar tabelas datajud_monitored_processes, datajud_notification_config, datajud_alerts
2. **Frontend - Tipos**: Atualizar types.ts com novos tipos
3. **Frontend - Hooks**: Criar hooks de CRUD (useMonitoredProcesses, useNotificationConfig, useProcessAlerts)
4. **Frontend - Aba Monitoramento**: Criar MonitoringTab com lista, adicao individual e importacao em lote
5. **Frontend - Aba Configuracoes**: Criar SettingsTab com selecao de agente e telefones
6. **Frontend - Integracao Busca**: Adicionar botao "Monitorar" no ProcessCard e ProcessDetailsSheet
7. **Frontend - Refatorar Pagina**: Converter DataJudSearchPage para usar Tabs
8. **Backend - Edge Function**: Criar datajud-monitor para verificacao periodica
9. **Backend - Cron**: Configurar pg_cron para execucao a cada 6 horas
10. **Alertas Realtime**: Configurar Realtime na tabela datajud_alerts
