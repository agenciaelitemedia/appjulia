

## Goal
Refinar UX da barra de envio quando a conversa **não está assumida** (showClaimBanner ativo):
1. **Apenas o ícone de Nota Interna fica ativo** — todos os outros botões (emoji, anexo, quick messages, agendar, format, mic, send, textarea) ficam desabilitados/ocultos.
2. Textarea só fica habilitada **depois** que o usuário clicar no ícone de nota e entrar em `noteMode`.
3. Após enviar a nota, o textarea volta a ficar desativado (sai de `noteMode` automaticamente).
4. Adicionar **3 tipos de nota** acessíveis via menu (DropdownMenu) que abre ao clicar no ícone de nota:
   - **Informativa** (azul — padrão atual)
   - **Dúvida** (amarelo)
   - **Urgência** (vermelho)

## Investigação
Já tenho o código de `ChatInput.tsx`. Preciso conferir:
- `sendInternalNote` (assinatura no `WhatsAppDataContext`) — aceita um campo de tipo/cor? Provavelmente não. Precisarei ver se a tabela de notas internas tem coluna `note_type` ou similar; se não tiver, criar migration.
- Como o `MessageBubble`/renderização de nota interna pinta o fundo hoje (azul fixo) — para passar a usar a cor conforme `note_type`.

Arquivos a inspecionar antes de codar:
- `src/contexts/WhatsAppDataContext.tsx` (assinatura `sendInternalNote`)
- `src/components/chat/MessageBubble.tsx` (render de nota interna)
- Schema atual: `chat_messages` — checar colunas existentes (provavelmente já há `internal_note` boolean; falta `note_type`).

## Mudanças

### 1. Banco de dados
Migration para adicionar coluna `note_type` em `chat_messages`:
- Tipo: `text`, default `'info'`, valores aceitos via trigger de validação (não CHECK por imutabilidade): `info | question | urgent`.
- Backfill: registros existentes com nota interna recebem `'info'`.

### 2. `WhatsAppDataContext.sendInternalNote`
- Adicionar parâmetro opcional `noteType: 'info' | 'question' | 'urgent'` (default `'info'`).
- Persistir no insert/update do `chat_messages.note_type`.

### 3. `ChatInput.tsx`
**Estado novo**: `noteType: 'info' | 'question' | 'urgent'` (default `'info'`).

**Lock total quando `showClaimBanner === true` E `!noteMode`**:
- Esconder/desabilitar: emoji, anexo, quick messages, schedule, format toggle, mic, send.
- Textarea: `disabled` e placeholder "Assuma a conversa ou abra uma nota interna".
- Único botão clicável: o ícone de Nota Interna (StickyNote).

**Menu de tipos de nota**:
- Trocar o `Button` simples do StickyNote por um `DropdownMenu`:
  - 3 itens: Informativa (azul), Dúvida (amarelo), Urgência (vermelho).
  - Ao escolher: `setNoteMode(true); setNoteType(escolhido)` e foca textarea.
- Quando `noteMode === true`, o ícone passa a mostrar a cor do tipo escolhido como background do botão.
- O bloco indicador de "Nota Interna" no topo passa a usar cor dinâmica (`bg-blue-500/10`, `bg-yellow-500/10`, `bg-red-500/10` + borda/ícone correspondentes) e label muda ("Nota Informativa" / "Nota de Dúvida" / "Nota de Urgência").

**Pós-envio**:
- Em `handleSend`, quando `noteMode`, após sucesso: `setNoteMode(false); setNoteType('info')` (textarea volta a ser controlado pelo `canSend`/banner).

**`canSend` atual**: já cobre `noteMode || (assigned && active)`. Manter. Apenas garantir que quando `showClaimBanner && !noteMode`, todos os controles auxiliares fiquem `disabled` — isso já é parcialmente feito via `inputBlocked = showClaimBanner` (que aplica `pointer-events-none` no wrapper). Refinar: deixar o ícone de nota **fora** desse wrapper bloqueado, ou usar uma flag específica que mantenha apenas o StickyNote interativo.

Solução: remover o `inputBlocked` do wrapper inteiro e aplicar `disabled` individualmente em cada botão usando `!canSend` (já existe parcialmente). O StickyNote nunca recebe `disabled`. O textarea recebe `disabled={!canSend || isSending}` (já é o comportamento desejado: quando não assumida e fora de noteMode → bloqueado).

### 4. `MessageBubble.tsx`
Quando renderizar nota interna, ler `note_type` e aplicar cor:
- `info` → azul (atual)
- `question` → amarelo (`bg-yellow-500/15 border-yellow-500/40`)
- `urgent` → vermelho (`bg-red-500/15 border-red-500/40`)
- Manter ícone StickyNote, opcionalmente trocar (HelpCircle p/ dúvida, AlertTriangle p/ urgência).

## Arquivos a editar
- `supabase` migration (nova coluna + trigger)
- `src/contexts/WhatsAppDataContext.tsx` (assinatura `sendInternalNote`)
- `src/components/chat/ChatInput.tsx` (UX + menu de tipo)
- `src/components/chat/MessageBubble.tsx` (render por tipo)

## Validação
1. Conversa não assumida: apenas ícone de nota clicável; menu abre 3 opções.
2. Selecionar "Dúvida" → barra fica amarela, textarea habilita, enviar → bolha amarela na timeline.
3. Após envio, textarea volta a ficar desabilitada (banner "Assumir" continua).
4. Conversa já assumida: comportamento normal; ícone de nota também abre o menu de 3 tipos.
5. Notas antigas continuam aparecendo em azul (default `info`).

