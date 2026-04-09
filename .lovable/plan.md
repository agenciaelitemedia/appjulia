

# Assistente de Suporte — Abas Logs, Grupos e Colaboradores

## Resumo

Adicionar 3 funcionalidades ao módulo Assistente de Suporte:
1. **Aba Logs** — exibir mensagens gravadas em `support_group_messages` com paginação
2. **Aba Grupos** — listar grupos via API UaZapi (`/group/list`), com foto, nome, quantidade de participantes, e lista colapsável separando colaboradores Julia vs clientes
3. **Aba Configuração** — adicionar seção para cadastrar JIDs/números dos colaboradores da Julia (nova tabela)

## 1. Migração: tabela `support_team_members`

```sql
CREATE TABLE public.support_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(phone)
);

ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on support_team_members"
  ON public.support_team_members FOR ALL
  USING (true) WITH CHECK (true);
```

Esta tabela armazena os números/JIDs dos colaboradores da Julia para classificar mensagens como "suporte" vs "cliente".

## 2. Novos componentes

### `src/pages/suporte-assistente/components/SupportLogsTab.tsx`

- Query paginada em `support_group_messages` (20 por página)
- Tabela: timestamp, grupo, remetente, tipo, texto (truncado)
- Badge colorido: se `sender_jid` está na lista de `support_team_members` → "Suporte", senão → "Cliente"
- Botões anterior/próximo para paginação
- Filtro por grupo ou remetente

### `src/pages/suporte-assistente/components/SupportGroupsTab.tsx`

- Ao montar, chama API UaZapi `GET {api_url}/group/list` com header `token`
- Lista cada grupo: foto (`pictureUrl`), nome (`subject`), contagem de participantes
- Cada grupo é um `Accordion` colapsável
- Ao expandir: lista participantes separados em "Colaboradores Julia" (match com `support_team_members`) e "Clientes"
- Cada participante mostra JID e nome (se disponível)

### `src/pages/suporte-assistente/components/SupportTeamConfig.tsx`

- CRUD simples na tabela `support_team_members`
- Campos: número de telefone e nome
- Lista existente com botão remover
- Adicionado na aba Configuração abaixo dos cards existentes

## 3. Alteração: `SupportAssistantPage.tsx`

- Importar os 3 novos componentes
- Adicionar abas "Logs" e "Grupos" ao `TabsList`
- Abas só aparecem se `isConfigured` (instância criada)
- Inserir `<SupportTeamConfig />` dentro da aba Configuração

## Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `support_team_members` |
| `src/pages/suporte-assistente/components/SupportLogsTab.tsx` | Novo — aba de logs paginados |
| `src/pages/suporte-assistente/components/SupportGroupsTab.tsx` | Novo — lista de grupos com participantes |
| `src/pages/suporte-assistente/components/SupportTeamConfig.tsx` | Novo — CRUD de colaboradores |
| `src/pages/suporte-assistente/SupportAssistantPage.tsx` | Adicionar abas e integrar componentes |

