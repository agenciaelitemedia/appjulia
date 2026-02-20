
## Integrar status da Julia diretamente no header do popup de mensagens

### Objetivo

Remover a necessidade de abrir um dialogo separado para ver/controlar o status da Julia. O icone do robo no header do popup de mensagens ja deve refletir visualmente se a Julia esta ativa (verde) ou inativa (vermelha), e ao lado dele um Switch permite ativar/desativar diretamente, com confirmacao.

### Mudancas no arquivo `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

#### 1. Adicionar estado e logica de sessao diretamente no componente

- Importar `Switch` de `@/components/ui/switch`
- Importar `AlertDialog` e seus subcomponentes
- Criar estados: `sessionStatus` (active/inactive/unknown), `sessionLoading`, `sessionData`, `confirmToggle`, `updating`
- Ao abrir o dialogo (quando `open` e `codAgent` e `whatsappNumber` mudam), chamar `externalDb.getSessionStatus(whatsappNumber, codAgent)` para obter o status atual
- Reutilizar a mesma logica de toggle que ja existe no `SessionStatusDialog`

#### 2. Alterar o header (linhas 1087-1116)

Substituir o botao `Bot` estatico por:

```text
+----------------------------------------------------------+
| [Avatar]  Nome do Lead              [Bot] [Switch]   [X] |
|           whatsapp number                                 |
+----------------------------------------------------------+
```

- O icone `Bot`: cor dinamica baseada no status
  - Verde (`text-green-500`) quando `session.active === true`
  - Vermelho (`text-red-500`) quando `session.active === false`
  - `text-muted-foreground` quando carregando ou sem sessao
- `Switch` ao lado do Bot: checked = session.active, dispara confirmacao
- Ao clicar no Switch, abre AlertDialog de confirmacao (mesmo padrao atual)
- Apos confirmar, chama `externalDb.updateSessionStatus` e atualiza o estado local

#### 3. Remover dependencia do SessionStatusDialog

- Remover o estado `statusDialogOpen` e o componente `<SessionStatusDialog>` do JSX
- Remover o import de `SessionStatusDialog`
- O dialogo separado deixa de ser necessario pois tudo fica inline no header

### Detalhes tecnicos

**Novos imports:**
- `Switch` de `@/components/ui/switch`
- `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle` de `@/components/ui/alert-dialog`
- `SessionStatus` de `@/lib/externalDb` (tipo)

**Novos estados:**
```typescript
const [sessionData, setSessionData] = useState<SessionStatus | null>(null);
const [sessionLoading, setSessionLoading] = useState(false);
const [confirmToggle, setConfirmToggle] = useState(false);
const [updatingSession, setUpdatingSession] = useState(false);
```

**Funcao de fetch (dentro de useEffect ao abrir):**
```typescript
const fetchSessionStatus = async () => {
  setSessionLoading(true);
  try {
    const result = await externalDb.getSessionStatus(whatsappNumber, codAgent);
    setSessionData(result);
  } catch (err) {
    console.error('Erro ao buscar status:', err);
  } finally {
    setSessionLoading(false);
  }
};
```

**Funcao de toggle (com confirmacao):**
Reutiliza a mesma logica do `SessionStatusDialog.handleToggleStatus`.

**Header atualizado:**
- Bot com cor condicional: `className={cn("h-5 w-5", sessionData?.active === true ? "text-green-500" : sessionData?.active === false ? "text-red-500" : "text-muted-foreground")}`
- Switch inline: `<Switch checked={sessionData?.active ?? false} onCheckedChange={() => setConfirmToggle(true)} disabled={!sessionData || updatingSession || sessionLoading} className="scale-75" />`
- AlertDialog de confirmacao renderizado fora do Dialog principal (mesmo padrao atual)

**Remocoes:**
- Import de `SessionStatusDialog`
- Estado `statusDialogOpen`
- Componente `<SessionStatusDialog>` do JSX
- Botao ghost que abria o dialogo
