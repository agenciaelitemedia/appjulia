
## Objetivo
Replicar fielmente o layout do WhatsApp Web na lista de conversas: **timestamp + badge de não lidos sempre visíveis à direita**, com nome e preview truncando dinamicamente conforme o espaço disponível. Eliminar a 3ª linha de pills que hoje atrapalha o layout (mover para overlay/hover) e adotar a estrutura visual de 2 linhas do WhatsApp.

## Análise do HTML do WhatsApp Web
Estrutura essencial extraída do snippet:
```
[Avatar 49x49] [ Conteúdo flex-1 min-w-0 ]
                ├─ Linha 1: [nome truncate flex-1] [hora flex-shrink-0]
                └─ Linha 2: [preview truncate flex-1] [badge flex-shrink-0]
```
Pontos-chave do WhatsApp Web:
1. **Apenas 2 linhas de conteúdo** — não há "linha 3" com tags de fila/SLA empurrando layout.
2. Hora e badge são `flex-shrink-0` em colunas alinhadas à direita de cada linha (hora alinhada com nome, badge alinhada com preview).
3. Nome e preview usam `truncate` puro (CSS overflow + ellipsis), sem corte por contagem.
4. Badge verde só aparece quando `unread > 0`; quando 0, espaço é reservado vazio para não "subir" a hora.
5. Altura fixa do item (~72-95px) — previsível e estável.

## Diagnóstico do estado atual
O `ChatContactItem.tsx` atual já tem a base correta (2 colunas: esquerda flex-1 + direita flex-shrink-0), mas:
- **3ª linha de pills (fila/SLA/agente)** ocupa espaço vertical e ainda pode comprimir as duas primeiras linhas em larguras menores via `min-w-0` mal propagado.
- **Hora alinhada com badge** (lado direito empilhado) não espelha WhatsApp, onde **hora fica na mesma linha do nome** e **badge na mesma linha do preview**.
- Resultado: visualmente diferente do WhatsApp e propenso a quebras quando pills crescem.

## Refatoração (apenas `src/components/chat/ChatContactItem.tsx`)

### 1. Reestruturar para layout WhatsApp (2 linhas pareadas)
```
[Avatar] [ Conteúdo min-w-0 flex-1 ]
          ├─ Row 1: [name truncate flex-1 min-w-0] [time flex-shrink-0 ml-2]
          └─ Row 2: [preview truncate flex-1 min-w-0] [badge flex-shrink-0 ml-2]
```
- Cada row é `flex items-center gap-2 min-w-0`.
- Hora migra para a row 1 (lado do nome), não mais empilhada com o badge.
- Badge fica na row 2 (lado do preview); quando `unread === 0`, renderizar `<span className="w-5 h-5" />` placeholder para manter altura.

### 2. Realocar pills (fila/SLA/agente atribuído)
- **Remover a 3ª linha de pills do item da lista.** WhatsApp não tem isso — força layout previsível.
- Manter SLA badge **inline na row 1**, à esquerda da hora (compacto, ícone+tempo restante), só quando relevante. Demais pills (fila, agente) ficam disponíveis no painel de detalhes/header da conversa (já existem lá).
- Alternativa minimalista se o usuário preferir manter algum sinal visual: pequeno dot colorido ao lado do nome para indicar fila (ex: azul = fila X), sem texto.

### 3. Hierarquia visual fiel ao WhatsApp
- Nome: `font-medium text-[15px]` quando há não-lidos → `font-semibold`.
- Hora: `text-[12px]`; verde (`text-emerald-600 font-medium`) quando há não-lidos, cinza caso contrário.
- Preview: `text-[13px] text-muted-foreground`; mais escuro quando há não-lidos.
- Badge: círculo verde `bg-emerald-500 text-white`, `min-w-[20px] h-5 rounded-full`.

### 4. Garantias técnicas de truncamento
- Container raiz `<button>`: `w-full min-w-0 overflow-hidden`.
- Wrapper de conteúdo: `flex-1 min-w-0`.
- Cada row: `flex items-center gap-2 min-w-0`.
- Texto truncável: `flex-1 min-w-0 truncate` (a tríade obrigatória).
- Elementos fixos (hora, badge, ícones de mídia inline): `flex-shrink-0`.

## Arquivo
- `src/components/chat/ChatContactItem.tsx` — refatoração estrutural (remover 3ª linha de pills, mover hora para row 1, badge para row 2, manter SLA opcional inline).

## Validação
1. Sidebar 400px: nome longo trunca com `…`; hora "09:03" sempre visível à direita.
2. Conversa com não-lidos: badge verde aparece à direita do preview; hora em verde.
3. Conversa sem não-lidos: espaço do badge reservado, hora cinza, layout estável.
4. Mensagens de mídia (foto/vídeo/áudio): ícone inline + label, ainda truncam.
5. Redimensionar viewport de 1852px até 320px: lado direito (hora+badge) nunca some, texto à esquerda responde fluidamente.
6. SLA crítico: badge compacto aparece inline na row 1 antes da hora, sem quebrar layout.
