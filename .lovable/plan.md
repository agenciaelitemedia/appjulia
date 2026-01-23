

# Plano: Corrigir Apresentacao de Datas nas Mensagens

## Problema Identificado

A API UaZapi retorna `messageTimestamp` em **milissegundos** (13 digitos), mas o codigo trata como se fosse em **segundos** (10 digitos) e multiplica por 1000, resultando em datas no ano ~58000.

**Exemplo do log:**
```
"messageTimestamp": 1769137809620
```

**Calculo errado atual:**
- `1769137809620 * 1000` = data no ano 58000

**Calculo correto:**
- `1769137809620` ja e milissegundos = 23 de Janeiro de 2026 (correto!)

---

## Solucao

Criar funcao inteligente que detecta automaticamente se o timestamp esta em segundos ou milissegundos:

```typescript
function normalizeTimestamp(timestamp: number | string): number {
  if (typeof timestamp === 'string') {
    // ISO string ou numerico
    const parsed = Date.parse(timestamp);
    if (!isNaN(parsed)) return parsed;
    timestamp = parseInt(timestamp, 10);
  }
  
  if (!timestamp || isNaN(timestamp)) return Date.now();
  
  // Detectar se esta em segundos ou milissegundos
  // Timestamps em segundos tem ~10 digitos (ate 2033)
  // Timestamps em milissegundos tem ~13 digitos
  if (timestamp > 10000000000000) {
    // Ja esta em milissegundos
    return timestamp;
  } else if (timestamp > 10000000000) {
    // Ja esta em milissegundos (menor que 10^13 mas maior que segundos validos)
    return timestamp;
  } else {
    // Esta em segundos, converter para milissegundos
    return timestamp * 1000;
  }
}
```

---

## Alteracoes Necessarias

### 1. Adicionar funcao `normalizeTimestamp`

Nova funcao helper para normalizar timestamps independente do formato recebido.

### 2. Atualizar `loadMessages` (linha 753)

Antes:
```typescript
timestamp: msg.messageTimestamp || msg.timestamp || Date.now() / 1000,
```

Depois:
```typescript
timestamp: normalizeTimestamp(msg.messageTimestamp || msg.timestamp || Date.now()),
```

### 3. Atualizar `formatMessageTime` (linhas 837-840)

Antes:
```typescript
const formatMessageTime = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return format(date, 'HH:mm', { locale: ptBR });
};
```

Depois:
```typescript
const formatMessageTime = (timestamp: number) => {
  const date = new Date(timestamp);  // Ja normalizado para ms
  return format(date, 'HH:mm', { locale: ptBR });
};
```

### 4. Atualizar `formatMessageDate` (linhas 842-845)

Antes:
```typescript
const formatMessageDate = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return format(date, "dd 'de' MMM", { locale: ptBR });
};
```

Depois:
```typescript
const formatMessageDate = (timestamp: number) => {
  const date = new Date(timestamp);  // Ja normalizado para ms
  return format(date, "dd 'de' MMM", { locale: ptBR });
};
```

### 5. Atualizar `handleSendMessage` (linha 807)

Antes:
```typescript
timestamp: Date.now() / 1000,
```

Depois:
```typescript
timestamp: Date.now(),  // Milissegundos
```

---

## Arquivo a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Adicionar `normalizeTimestamp`, atualizar funcoes de formatacao e parsing |

---

## Resultado Esperado

- Mensagens de hoje mostrarao "23 de jan" (data atual correta)
- Horarios mostrarao valores corretos como "14:30" em vez de horas absurdas
- Compatibilidade com APIs que retornam segundos ou milissegundos
- Agrupamento por data funcionara corretamente

