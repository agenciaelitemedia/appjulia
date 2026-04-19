
## Problema
O áudio da API oficial continua corrompido mesmo depois do ajuste de MIME.

## O que a análise mostra
- O envio para `waba-send` já está chegando com `audio/ogg; codecs=opus` e começando com `OggS`, então o problema não é mais só “label errado”.
- Pelos logs, o arquivo convertido que vai para a oficial está muito pequeno para um áudio de vários segundos (ex.: ~4.6 KB), o que indica que a corrupção acontece **na conversão client-side**, antes do upload.
- A UaZapi continua melhor porque usa o blob nativo do navegador e praticamente não depende dessa conversão.

## Causa raiz provável
O remuxer customizado em `src/lib/audio/webmToOgg.ts` está gerando um OGG formalmente válido, mas **incompleto/truncado** para os blobs do `MediaRecorder` do navegador. Ou seja: o cabeçalho OGG existe, porém os pacotes/duração não estão sendo preservados corretamente.

## Plano de correção
1. **Corrigir/substituir a conversão WebM -> OGG**
   - Revisar `src/lib/audio/webmToOgg.ts` para tratar corretamente os blocos/pacotes do WebM gravado pelo navegador.
   - Se a implementação atual continuar frágil, trocar por uma abordagem mais confiável para gerar OGG/Opus no frontend.

2. **Fortalecer a validação antes de enviar para a oficial**
   - Em `src/contexts/WhatsAppDataContext.tsx`, não validar só `OggS`.
   - Validar também se o blob convertido tem tamanho/duração coerentes antes de usá-lo no `waba-send`.
   - Se a conversão falhar, bloquear o envio com erro explícito, em vez de enviar um OGG quebrado.

3. **Manter a separação por provedor**
   - **API oficial**: usar apenas OGG/Opus realmente íntegro.
   - **UaZapi**: continuar usando o blob nativo do navegador (WebM/Opus ou MP4), preservando o funcionamento atual.

4. **Preservar o fluxo de storage sem quebrar os provedores**
   - Garantir que o arquivo persistido em `chat-media-upload` corresponda ao arquivo realmente enviado para cada provedor.
   - Evitar qualquer relabel que masque bytes inválidos.

5. **Validar os cenários críticos**
   - Gravação de áudio no Chrome -> API oficial
   - Gravação de áudio no Chrome -> UaZapi
   - Safari/iPhone com `audio/mp4` -> API oficial
   - Upload de áudio já pronto (sem gravação) -> ambos os provedores

## Arquivos principais
- `src/lib/audio/webmToOgg.ts`
- `src/contexts/WhatsAppDataContext.tsx`

## Resultado esperado
- API oficial recebe um OGG/Opus íntegro, com duração correta.
- UaZapi continua enviando o áudio normalmente.
- O sistema deixa de aceitar/salvar conversões corrompidas silenciosamente.
