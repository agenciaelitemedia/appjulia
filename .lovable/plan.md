# Objetivo

Reorganizar o `DealDetailsSheet` para:
1. Remover a etapa do título (já está no bloco "Etapas").
2. Aumentar levemente a fonte do título.
3. Tornar os botões de rodapé contextuais (CRM vs Chat).
4. Garantir que o **conteúdo central role** quando ultrapassar a altura do sheet, mas os **botões do rodapé fiquem sempre fixos** na parte de baixo (sem rolar junto).

---

## 1. `DealDetailsSheet.tsx` — Header

Arquivo: `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx`

- **Remover** do `SheetHeader` o badge da etapa (bolinha colorida + nome do `pipeline`). Essa info já está no bloco "Etapas" logo abaixo.
- **Aumentar fonte do título**: trocar `text-lg` → `text-xl` (mantendo `font-semibold`).
- Manter título + valor/contato/etc. como estão.

---

## 2. Layout com rodapé fixo + conteúdo rolável

Hoje o `SheetContent` usa `p-6` e empilha tudo verticalmente, então quando o conteúdo cresce ele rola junto com os botões. Vamos reestruturar para flex column de altura total:

```tsx
<SheetContent className="w-full sm:max-w-xl p-0 flex flex-col h-full">
  {/* Header — fixo no topo */}
  <div className="px-6 pt-6 pb-3 border-b shrink-0">
    <SheetHeader>...</SheetHeader>
  </div>

  {/* Bloco Etapas — fixo, logo abaixo do header */}
  <div className="px-6 py-3 border-b shrink-0">...</div>

  {/* Conteúdo (Tabs Detalhes/Atividade) — ROLÁVEL */}
  <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
    <Tabs>...</Tabs>
  </div>

  {/* Footer — FIXO no rodapé, nunca rola */}
  <div className="border-t px-6 py-3 shrink-0 bg-background">
    {footerContent}
  </div>
</SheetContent>
```

Pontos-chave:
- `SheetContent` vira `flex flex-col h-full p-0` (padding por seção).
- A área central recebe `flex-1 overflow-y-auto min-h-0` — é a única que rola.
- Header, bloco Etapas e Footer têm `shrink-0` para nunca encolher e nunca rolar.
- Footer ganha `bg-background` para não vazar conteúdo por trás se houver shadow.

---

## 3. Footer contextual

Adicionar lógica para escolher entre:

### 3a. CRM (padrão — quando `footerExtra` NÃO é passado e `hideStatusActions` é false)
Duas linhas:
```
[ Editar | Perdido | Ganho ]
[          Arquivar         ]   ← largura total
```
- Linha 1: três botões em `grid grid-cols-3 gap-2`.
- Linha 2: botão `Arquivar` `w-full variant="outline"` (ou destrutivo suave).

### 3b. Arquivar com dupla confirmação
- Importar `AlertDialog` de `@/components/ui/alert-dialog`.
- Estado local `const [confirmArchive, setConfirmArchive] = useState(false)`.
- Clicar em "Arquivar" abre o `AlertDialog` com:
  - Título: "Arquivar este card?"
  - Descrição: "Esta ação removerá o card do board. Você pode restaurá-lo depois em arquivados."
  - Botões: `Cancelar` / `Confirmar arquivamento` (variant destructive). Confirmar chama `onArchive()`.

### 3c. Chat (quando `footerExtra` é passado)
Renderiza apenas `footerExtra` (que já contém `[ Fechar | Abrir no CRM ]` vindo do `ChatLinkedDealSheet`). Sem alteração nesse componente.

---

## 4. `ChatLinkedDealSheet.tsx`

Sem mudanças funcionais. Continua passando:
- `hideStatusActions`
- `hideArchiveAction`
- `footerExtra={ <Fechar /> <Abrir no CRM /> }`

O footer fixo já funcionará automaticamente porque agora o `SheetContent` tem o layout flex.

---

## 5. `BoardPage.tsx`

Sem mudanças. Continua passando `stages` e `onMoveToStage`. Os botões padrão (Editar/Perdido/Ganho/Arquivar) aparecerão automaticamente porque `footerExtra` não é passado.

---

## Comportamento esperado

- **Sheet sempre ocupa altura total** da viewport (`h-full`).
- **Header + bloco Etapas** ficam fixos no topo.
- **Conteúdo das abas (Detalhes/Atividade)** rola internamente quando excede o espaço disponível.
- **Rodapé sempre visível** com os botões corretos:
  - CRM: `[Editar | Perdido | Ganho]` + `[Arquivar]` (com dupla confirmação via AlertDialog).
  - Chat: `[Fechar | Abrir no CRM]`.
- Título do header sem etapa, fonte um pouco maior (`text-xl`).

---

## Arquivos a editar

- `src/pages/crm-builder/components/deals/DealDetailsSheet.tsx` — header sem etapa, `text-xl`, layout flex com scroll central + footer fixo, AlertDialog de arquivamento.
