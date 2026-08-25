# Vincular ligações ao contato (VoIP + ZAP Call) na origem

## Diagnóstico (confirmado no banco)

- Existem 6 ligações VoIP para o contato citado (client_id 300, dias 24 e 25/08), mas a aba **Voip Call** fica vazia.
- Em `phone_call_logs` o destino é gravado em formato **nacional** (`075983342048`, 12 caracteres, 0 + DDD + número) e `caller` é sempre o **ramal** (4 dígitos). Não existe coluna de contato nem telefone em E.164.
- O hook `useContactCallHistory` compara por igualdade exata com as variantes internacionais do contato (`55…` 12/13 dígitos) — nenhuma bate com `0…`, então o resultado é sempre vazio.
- Em `wavoip_call_logs` já existem as colunas `contact_id` e `conversation_id`, mas estão **100% nulas** (0 de 219 registros preenchidos). Hoje a aba ZAP Call só funciona por coincidência de formato (`55…` com 12 dígitos).

Conclusão: casar número por texto na hora da leitura é frágil (formato nacional vs. internacional, 9º dígito, DDI). O certo é gravar o vínculo na origem.

## Abordagem recomendada (vínculo na origem + fallback)

### 1. Padronizar o telefone na gravação
Adicionar em `phone_call_logs` duas colunas:
- `contact_phone_e164` (texto): número do cliente já normalizado em formato canônico BR (`55DDD9XXXXXXXX`), independente da direção.
- `contact_id` (uuid): referência ao contato de chat (`chat_contacts`), quando encontrado.

Em `wavoip_call_logs` as colunas já existem — só passam a ser preenchidas.

### 2. Preencher no momento da ligação
- **VoIP**: nos webhooks/proxies `api4com-webhook`, `threecplus-webhook`, `api4com-proxy`, `threecplus-proxy`, ao gravar/atualizar o log, normalizar o número do cliente (lado que não é ramal) com o helper compartilhado de normalização BR e resolver o `contact_id` por `client_id` + variantes do telefone em `chat_contacts`.
- **ZAP Call**: em `wavoip-call-webhook` (e nos pontos de sync/reconcile), gravar `contact_phone` normalizado, `contact_id` e, quando houver, `conversation_id` da conversa aberta.
- Resolução do contato feita por uma função utilitária única e compartilhada (`resolveContactByPhone`), usada por todos esses pontos, para não duplicar regra do 9º dígito.

### 3. Backfill dos registros existentes
Uma migração de dados normaliza `contact_phone_e164` a partir de `called`/`caller` (VoIP) e `from_number`/`to_number` (ZAP), e preenche `contact_id` casando com `chat_contacts` por `client_id` + variantes. Registros sem contato correspondente ficam com `contact_id` nulo e só o telefone normalizado.

### 4. Leitura simplificada
`useContactCallHistory` passa a filtrar por `contact_id` quando disponível e, como rede de segurança, por `contact_phone_e164 in (variantes)` — sem mais comparação com formato nacional. Isso deixa o histórico consultável de qualquer lugar do sistema (chat, card do CRM Builder, ficha do contato, futuros relatórios) com o mesmo filtro.

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| A. Vínculo na origem + telefone canônico (recomendada) | Consulta simples e rápida, reutilizável em qualquer tela, imune a formato do provedor | Exige migração + ajuste nos webhooks |
| B. Só normalizar o telefone (sem `contact_id`) | Menos mudança, resolve o caso atual | Não sobrevive a troca/mescla de contato; sem join direto |
| C. Só corrigir a query (match por sufixo de 8 dígitos) | Mudança mínima, sem banco | Risco de falso positivo entre DDDs, custo de busca maior, problema volta em cada nova tela |

Recomendo A, mantendo o comportamento de C apenas como fallback temporário durante o backfill.

## Melhorias sugeridas junto

- Índices: `(client_id, contact_id, started_at desc)` e `(client_id, contact_phone_e164)` nas duas tabelas de log.
- Preencher também `conversation_id` no ZAP Call, permitindo mostrar a ligação dentro da própria timeline da conversa no futuro.
- Reaproveitar o mesmo vínculo para o card do CRM Builder (aba Telefonia já compartilhada) sem nenhuma query nova.
- Manter o helper de normalização único em `supabase/functions/_shared/phone-normalize.ts` (já existe) para frontend/edge não divergirem.

## Detalhes técnicos

- Migração: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, sem NOT NULL, mais criação dos índices; nenhuma quebra para o código atual.
- Nos webhooks o vínculo é resolvido de forma tolerante a falha: se a busca do contato falhar, grava o log normalmente com `contact_id` nulo (nunca perder CDR).
- Nenhuma alteração no player de gravação nem no layout da aba Telefonia.
