

# Auto-conectar ramal do usuário logado ao abrir Discador/CRM

## Problema atual
O usuário precisa selecionar manualmente o ramal no dropdown toda vez que abre o discador ou o dialog de ligação do CRM. Deveria já estar conectado automaticamente.

## Solução

### 1. `DiscadorTab.tsx` — auto-connect ao montar
- Importar `useAuth` para obter `user.id`
- Ao carregar `extensions`, encontrar a extensão onde `assigned_member_id === user.id`
- Se encontrada: auto-selecionar e conectar SIP automaticamente (chamar `handleSelectExtension`)
- Se não encontrada: exibir estado "indisponível" (ícone de telefone cinza + mensagem "Nenhum ramal vinculado ao seu usuário")
- Remover dropdown de seleção manual (ou mantê-lo readonly mostrando o ramal vinculado)
- Desabilitar o teclado e botão de discar quando sem ramal

### 2. `PhoneCallDialog.tsx` — auto-connect ao abrir
- Importar `useAuth` para obter `user.id`
- Ao carregar extensões (quando `open === true`), encontrar extensão do usuário por `assigned_member_id`
- Se encontrada: auto-selecionar e conectar SIP
- Se não encontrada: mostrar telefone cinza + "Você não possui ramal ativo" + desabilitar botão Ligar
- Remover dropdown de seleção manual

### 3. Estado visual "indisponível"
- Ícone `Phone` com classe `text-muted-foreground` (cinza)
- Badge "Indisponível" cinza
- Mensagem explicativa: "Nenhum ramal vinculado ao seu usuário. Solicite ao administrador."

## Arquivos alterados
- `src/pages/telefonia/components/DiscadorTab.tsx`
- `src/pages/crm/components/PhoneCallDialog.tsx`

