

# Plano: Corrigir Play de Audio e Timezone das Mensagens

## Problemas Identificados

### 1. Audio nao Toca
Na imagem enviada, o botao play do audio aparece mas nao funciona. Analisando o codigo:

- **Linha 527-561**: O `case 'audio'` so renderiza o elemento `<audio>` se `effectiveMediaUrl` (downloadedUrl ou mediaUrl) existir
- **Problema**: Quando a API retorna `fileURL: ""` (vazio), nao ha URL para tocar. O audio precisa ser baixado via `/message/download`
- **UX atual**: Mostra barra cinza com duracao, mas clicar nao faz nada (ou nao indica claramente que precisa baixar)

### 2. Timezone Incorreto
Na segunda imagem, mensagens de 23:57-23:58 aparecem no separador "21 de jan" quando deveriam estar em "22 de jan".

- **Linhas 1062-1070**: `formatMessageTime` e `formatMessageDate` usam `new Date(timestamp)` direto
- **Problema**: O timestamp vem da API em segundos (epoch UTC). Ao converter com `new Date()`, o JavaScript usa o timezone local do navegador
- **Impacto**: Se o servidor da API esta em UTC e o usuario esta em Sao Paulo (UTC-3), as datas podem estar sendo calculadas incorretamente

---

## Solucao 1: Corrigir Reproducao de Audio

Modificar o `case 'audio'` para:
1. Quando nao tem URL, mostrar um botao de play clicavel que dispara o download
2. Apos download, substituir o botao pelo player de audio nativo
3. Adicionar indicador visual de loading enquanto baixa

```typescript
case 'audio': {
  const audioUrl = effectiveMediaUrl;
  
  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      {message.ptt ? (
        <Mic className="h-4 w-4 flex-shrink-0 text-green-500" />
      ) : null}
      
      {audioUrl ? (
        // Player de audio quando URL disponivel
        <audio 
          controls 
          src={audioUrl} 
          className="flex-1 h-8"
          preload="metadata"
        />
      ) : (
        // Botao de download quando URL nao disponivel
        <div 
          className={cn(
            "flex items-center gap-2 flex-1 cursor-pointer hover:opacity-80",
            isDownloading && "pointer-events-none"
          )}
          onClick={() => onDownload?.(message.id)}
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Carregando...</span>
            </>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-primary/80 flex items-center justify-center">
                <Play className="h-4 w-4 text-primary-foreground fill-current ml-0.5" />
              </div>
              <div className="flex flex-col flex-1">
                <div className="w-full h-1 bg-muted-foreground/30 rounded" />
                <span className="text-[10px] text-muted-foreground mt-1">
                  {formatDuration(message.seconds)}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Solucao 2: Corrigir Timezone para America/Sao_Paulo

### Opcao A: Usar Intl.DateTimeFormat (recomendado)

Atualizar as funcoes de formatacao para usar timezone explicito:

```typescript
const formatMessageTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const formatMessageDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
  });
};
```

### Alternativa B: Converter timestamp para timezone correto

Se a API retorna timestamp ja em UTC, garantir que a conversao respeita o fuso:

```typescript
import { format, toZonedTime } from 'date-fns-tz';

const formatMessageTime = (timestamp: number) => {
  const zonedDate = toZonedTime(new Date(timestamp), 'America/Sao_Paulo');
  return format(zonedDate, 'HH:mm', { locale: ptBR });
};

const formatMessageDate = (timestamp: number) => {
  const zonedDate = toZonedTime(new Date(timestamp), 'America/Sao_Paulo');
  return format(zonedDate, "dd 'de' MMM", { locale: ptBR });
};
```

**Nota**: A Opcao A nao requer dependencia adicional. A Opcao B requer `date-fns-tz`.

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | Corrigir case 'audio' e funcoes de formatacao de data |

---

## Resumo das Correcoes

| Problema | Linha Atual | Correcao |
|----------|-------------|----------|
| Audio sem URL nao toca | 535-559 | Adicionar botao Play que dispara download |
| Audio sem feedback visual | 550-558 | Melhorar UI com botao circular e loading |
| Timezone incorreto (hora) | 1062-1065 | Usar `toLocaleTimeString` com timezone explicito |
| Timezone incorreto (data) | 1067-1070 | Usar `toLocaleDateString` com timezone explicito |

---

## Resultado Esperado

- Audios mostrarao botao de play clicavel mesmo sem URL
- Ao clicar, o audio sera baixado e comecara a tocar automaticamente
- Indicador de loading enquanto audio esta sendo baixado
- Datas e horarios serao exibidos corretamente no fuso de Sao Paulo
- Mensagens de 23:57 do dia 22/01 aparecerão no separador correto "22 de jan"

