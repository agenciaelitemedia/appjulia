

## Goal
1. **Bloquear textarea** quando a conversa não foi assumida (`showClaimBanner` / `!canSend`). Hoje o `Textarea` tem `disabled={isSending}` — falta `!canSend`. Só destrava ao entrar em `noteMode` (já implementado via `canSend = noteMode || ...`).
2. **Mensagens longas** no chat ganham truncamento estilo WhatsApp ("Ler mais" / "Ler menos") — limite ~350 caracteres ou ~6 linhas.

## Mudanças

### 1. `src/components/chat/ChatInput.tsx` (linha 487)
Trocar:
```tsx
disabled={isSending}
```
por:
```tsx
disabled={isSending || !canSend}
```
E ajustar o `placeholder` para refletir o estado bloqueado:
```tsx
placeholder={
  !canSend
    ? 'Assuma a conversa ou abra uma nota interna para escrever...'
    : noteMode
      ? 'Digite uma nota interna... (use @ para mencionar)'
      : 'Digite uma mensagem... (/ atalhos, cole imagem)'
}
```
Também desabilitar o botão de microfone (linha 508) com `disabled={!canSend}`, mantendo coerência com os demais botões já travados.

### 2. Novo componente `src/components/chat/ExpandableMessageText.tsx`
Componente leve que recebe `text` e `formatter` (a função `formatWhatsAppText`). Regras:
- Se `text.length <= 350` E número de quebras de linha `<= 6` → renderiza inteiro (sem botão).
- Caso contrário → renderiza versão truncada (`text.slice(0, 350)` + "…" preservando `formatWhatsAppText` no slice) + botão `Ler mais`. Ao expandir, mostra integral + botão `Ler menos`.
- Estado local `expanded` controla a alternância.
- Botão estilo link discreto (`text-xs font-medium underline-offset-2 hover:underline opacity-80`), cor herdada do contêiner (funciona em bolha verde `#DCF8C6` e cinza `#F0F2F5`).

### 3. `src/components/chat/MessageBubble.tsx`
Substituir o render direto do texto em **dois pontos**:

**3a. Bolha normal (linha 545-549):**
```tsx
{message.text && message.type === 'text' && (
  <ExpandableMessageText text={message.text} formatter={formatWhatsAppText} />
)}
```

**3b. Bolha de nota interna (linha 466-470):** mesma substituição, mas mantendo as classes de cor (`noteStyles.body`) — passar `className` para o componente.

**3c. Caption de mídia (linhas 215, 251):** aplicar mesma lógica para `message.caption` quando longo (mesmo limite). Usar o componente.

`formatWhatsAppText` continua sendo a fonte única de formatação; o componente apenas decide o que passar pra ela (texto truncado vs integral).

## Arquivos a editar/criar
- `src/components/chat/ChatInput.tsx` (2 ajustes pequenos)
- `src/components/chat/MessageBubble.tsx` (4 substituições de render)
- `src/components/chat/ExpandableMessageText.tsx` (novo, ~40 linhas)

## Validação
1. Conversa não assumida: textarea aparece **disabled** com placeholder "Assuma a conversa..."; clicando no ícone de Nota → menu abre; escolhendo um tipo → textarea destrava.
2. Após enviar nota, textarea volta a ficar disabled.
3. Mensagem com 1500 caracteres → mostra trecho + "Ler mais"; clicar expande; "Ler menos" recolhe.
4. Caption longa de imagem/vídeo → mesmo comportamento.
5. Mensagens curtas continuam sem botão.

