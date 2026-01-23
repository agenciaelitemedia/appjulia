

# Plano: Adicionar Mensagens Citadas e Formatacao de Texto WhatsApp

## Visao Geral

Adicionar duas funcionalidades ao chat do WhatsApp:
1. Exibicao de mensagens citadas (quoted messages) - quando uma mensagem e uma resposta a outra
2. Formatacao de texto estilo WhatsApp (*negrito*, _italico_, ~tachado~, ```monoespaco```)

---

## 1. Formatacao de Texto WhatsApp

Criar uma funcao que detecta e aplica formatacao estilo WhatsApp:

| Sintaxe | Resultado |
|---------|-----------|
| `*texto*` | **negrito** |
| `_texto_` | _italico_ |
| `~texto~` | ~~tachado~~ |
| ``` `texto` ``` | `monoespaco` |

A funcao `renderFormattedText` vai processar o texto antes de renderizar links, aplicando as formatacoes na ordem correta.

```typescript
function renderFormattedText(text: string): React.ReactNode {
  if (!text) return null;
  
  // Regex para cada tipo de formatacao
  const formatPatterns = [
    { pattern: /\*([^*]+)\*/g, render: (match: string) => <strong key={...}>{match}</strong> },
    { pattern: /_([^_]+)_/g, render: (match: string) => <em key={...}>{match}</em> },
    { pattern: /~([^~]+)~/g, render: (match: string) => <del key={...}>{match}</del> },
    { pattern: /`([^`]+)`/g, render: (match: string) => <code key={...}>{match}</code> },
  ];
  
  // Processar URLs primeiro, depois formatacao
  // ...
}
```

---

## 2. Mensagens Citadas (Quoted Messages)

### 2.1 Atualizar Interface Message

Adicionar campos para armazenar dados da mensagem citada:

```typescript
interface Message {
  // ... campos existentes ...
  quotedId?: string;           // ID da mensagem citada
  quotedText?: string;         // Texto da mensagem citada
  quotedParticipant?: string;  // Nome/numero de quem enviou
}
```

### 2.2 Extrair Dados da Citacao

Atualizar o parsing em `loadMessages` para extrair informacoes de `content.contextInfo`:

```typescript
// Extrair dados da mensagem citada
const contextInfo = msg.content?.contextInfo || messageContent.contextInfo;
const quotedMessage = contextInfo?.quotedMessage;

return {
  // ... outros campos ...
  quotedId: msg.quoted || contextInfo?.stanzaID,
  quotedText: quotedMessage?.conversation || quotedMessage?.extendedTextMessage?.text,
  quotedParticipant: contextInfo?.participant,
};
```

### 2.3 Componente QuotedMessage

Criar componente para exibir a mensagem citada:

```typescript
function QuotedMessage({ text, participant }: { text?: string; participant?: string }) {
  if (!text) return null;
  
  return (
    <div className="border-l-2 border-green-500 pl-2 mb-1 text-xs">
      {participant && (
        <span className="font-medium text-green-500 block">
          {formatParticipant(participant)}
        </span>
      )}
      <span className="text-muted-foreground line-clamp-2">
        {text}
      </span>
    </div>
  );
}
```

### 2.4 Integrar no MessageBubble

Exibir a mensagem citada acima do conteudo principal:

```typescript
function MessageBubble({ message }: { message: Message }) {
  return (
    <div>
      {message.quotedText && (
        <QuotedMessage 
          text={message.quotedText} 
          participant={message.quotedParticipant} 
        />
      )}
      {renderContent()}
    </div>
  );
}
```

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Adicionar formatacao de texto, suporte a quoted messages e componente QuotedMessage |

---

## Exemplo Visual do Resultado

```text
+------------------------------------------+
| ╔═══════════════════════════════════╗    |
| ║ Maria disse:                      ║    |
| ║ "Preciso do documento"            ║    |
| ╚═══════════════════════════════════╝    |
| Claro! Vou enviar o *documento*          |
| agora mesmo.                              |
|                                    14:30 |
+------------------------------------------+
```

---

## Ordem de Implementacao

1. Criar funcao `renderFormattedText` para formatacao de texto
2. Atualizar `renderTextWithLinks` para usar a formatacao
3. Adicionar campos de citacao na interface `Message`
4. Extrair dados de citacao no `loadMessages`
5. Criar componente `QuotedMessage`
6. Integrar no `MessageBubble`

---

## Detalhes Tecnicos

### Regex para Formatacao

```typescript
// Negrito: *texto* (nao pode ter espacos apos/antes dos asteriscos)
const boldRegex = /\*([^\s*][^*]*[^\s*]|\S)\*/g;

// Italico: _texto_
const italicRegex = /_([^\s_][^_]*[^\s_]|\S)_/g;

// Tachado: ~texto~
const strikeRegex = /~([^\s~][^~]*[^\s~]|\S)~/g;

// Monoespaco: `texto`
const codeRegex = /`([^`]+)`/g;
```

### Estrutura da Resposta UaZapi

Baseado nos logs do console, a estrutura de citacao e:

```json
{
  "quoted": "3EB0303A228A35E5DC110B",
  "content": {
    "contextInfo": {
      "participant": "167422740975656@lid",
      "quotedMessage": {
        "conversation": "Texto da mensagem original..."
      },
      "stanzaID": "3EB0303A228A35E5DC110B"
    },
    "text": "Resposta a mensagem"
  }
}
```

