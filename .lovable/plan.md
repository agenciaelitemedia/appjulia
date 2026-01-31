
# Plano: Corrigir Gravacao Presa em "Processando"

## Problema Identificado

A gravacao ja esta pronta na Daily.co (acabei de verificar com sucesso), mas o status no banco de dados fica em "processing" indefinidamente.

### Causa Raiz

O componente `RecordingDownloadButton` exibe apenas um Badge estatico quando `status === 'processing'`:

```tsx
if (status === 'processing') {
  return (
    <Badge variant="secondary" className="...">
      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
      Processando
    </Badge>
  );
}
```

Nao ha nenhum mecanismo para:
1. O usuario clicar e verificar se ja esta pronta
2. Polling automatico para verificar o status
3. Atualizacao automatica quando a gravacao fica disponivel

O status so muda para "ready" quando alguem chama a action `get-recording-link`, que:
1. Busca o link de download na API Daily.co
2. Atualiza o `recording_status` para "ready" no banco de dados

---

## Solucao Proposta

### Modificar `RecordingDownloadButton.tsx`

Quando o status for "processing", mostrar um botao clicavel que permite ao usuario verificar se a gravacao ja esta pronta:

```tsx
if (status === 'processing') {
  return (
    <Button 
      variant="ghost" 
      size="sm"
      onClick={handleCheckRecording}  // Novo handler
      disabled={isPending}
      className="h-8 px-2"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Processando
        </>
      )}
    </Button>
  );
}
```

O `handleCheckRecording` vai:
1. Chamar `get-recording-link` com o `recordingId`
2. Se sucesso: atualizar o estado local para mostrar botoes de download/copiar
3. Se erro: mostrar toast "Ainda processando, tente novamente em alguns minutos"

### Adicionar Verificacao Automatica (Polling)

Quando o componente monta com `status === 'processing'`, iniciar um polling a cada 30 segundos para verificar se a gravacao ficou pronta:

```tsx
useEffect(() => {
  if (status !== 'processing' || downloadUrl) return;
  
  const checkRecording = async () => {
    try {
      const response = await getLink(recordingId);
      if (response?.downloadLink) {
        setDownloadUrl(response.downloadLink);
      }
    } catch {
      // Silently ignore - still processing
    }
  };

  // Check after 30 seconds, then every 30 seconds
  const timeout = setTimeout(checkRecording, 30000);
  const interval = setInterval(checkRecording, 30000);
  
  return () => {
    clearTimeout(timeout);
    clearInterval(interval);
  };
}, [status, recordingId, downloadUrl]);
```

---

## Arquivo a Modificar

| Arquivo | Modificacao |
|---------|-------------|
| `src/pages/video/components/RecordingDownloadButton.tsx` | Adicionar botao clicavel quando processing + polling automatico |

---

## Detalhes da Implementacao

```tsx
// RecordingDownloadButton.tsx

export function RecordingDownloadButton({ 
  recordingId, 
  status,
  recordingUrl 
}: RecordingDownloadButtonProps) {
  const { mutate: getLink, mutateAsync: getLinkAsync, isPending } = useRecordingLink();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(recordingUrl || null);
  const [copied, setCopied] = useState(false);
  const [isReady, setIsReady] = useState(status === 'ready' || !!recordingUrl);

  // Auto-check recording status when processing
  useEffect(() => {
    // If already ready or has URL, skip
    if (isReady || downloadUrl) return;
    // Only poll when status is 'processing'
    if (status !== 'processing') return;
    
    const checkRecording = async () => {
      try {
        const response = await getLinkAsync(recordingId);
        if (response?.downloadLink) {
          setDownloadUrl(response.downloadLink);
          setIsReady(true);
        }
      } catch {
        // Still processing, ignore
      }
    };

    // First check after 30 seconds, then every 30 seconds
    const timeout = setTimeout(checkRecording, 30000);
    const interval = setInterval(checkRecording, 30000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [status, recordingId, downloadUrl, isReady, getLinkAsync]);

  // Handler for manual check when clicking on "Processando"
  const handleCheckRecording = () => {
    getLink(recordingId, {
      onSuccess: (data) => {
        if (data.downloadLink) {
          setDownloadUrl(data.downloadLink);
          setIsReady(true);
          toast.success('Gravacao pronta para download!');
        }
      },
      onError: () => {
        toast.info('Ainda processando. Tente novamente em alguns minutos.');
      },
    });
  };

  // ... rest of the component

  // Update the processing status check to be clickable
  if (status === 'processing' && !isReady) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleCheckRecording}
              disabled={isPending}
              className="h-8 px-2 text-warning-foreground"
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Processando
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clique para verificar se a gravacao esta pronta</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
}
```

---

## Resumo

1. **Badge "Processando" agora e clicavel**: Permite ao usuario verificar manualmente se a gravacao ja esta pronta
2. **Polling automatico a cada 30 segundos**: Verifica automaticamente se a gravacao ficou disponivel, sem necessidade de acao do usuario
3. **Estado local `isReady`**: Quando a verificacao detecta que a gravacao esta pronta, o componente atualiza para mostrar os botoes de download/copiar imediatamente
4. **Tooltip informativo**: Explica ao usuario que ele pode clicar para verificar o status
