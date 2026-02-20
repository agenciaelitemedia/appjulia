

## Restaurar SessionStatusDialog ao clicar no icone do robo

### O que muda

Manter tudo que foi implementado (icone colorido + Switch inline), mas adicionar a funcionalidade de abrir o `SessionStatusDialog` ao clicar no icone `Bot`.

### Alteracoes no arquivo `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

1. **Re-importar o SessionStatusDialog**
   - Adicionar `import { SessionStatusDialog } from './SessionStatusDialog';`

2. **Adicionar estado para controlar o dialogo**
   - `const [statusDialogOpen, setStatusDialogOpen] = useState(false);`

3. **Tornar o icone Bot clicavel**
   - Envolver o `Bot` em um `button` com `onClick={() => setStatusDialogOpen(true)}`
   - Adicionar `cursor-pointer hover:opacity-80 transition-opacity` para feedback visual

4. **Renderizar o SessionStatusDialog**
   - Adicionar o componente no JSX, passando `open={statusDialogOpen}`, `onOpenChange={setStatusDialogOpen}`, `whatsappNumber` e `codAgent`

5. **Sincronizar status apos fechar o dialogo**
   - Quando o `SessionStatusDialog` fechar (`onOpenChange(false)`), re-buscar o status da sessao para atualizar o icone e o Switch inline, garantindo que mudancas feitas dentro do dialogo sejam refletidas no header

### Detalhes tecnicos

**Novo import:**
```typescript
import { SessionStatusDialog } from './SessionStatusDialog';
```

**Novo estado:**
```typescript
const [statusDialogOpen, setStatusDialogOpen] = useState(false);
```

**Icone Bot clicavel (linhas 1152-1159):**
```typescript
<button
  type="button"
  onClick={() => setStatusDialogOpen(true)}
  className="hover:opacity-80 transition-opacity cursor-pointer"
  title="Ver status do atendimento"
>
  <Bot className={cn(
    "h-5 w-5",
    sessionLoading ? "text-muted-foreground animate-pulse" :
    sessionData?.active === true ? "text-green-500" :
    sessionData?.active === false ? "text-red-500" :
    "text-muted-foreground"
  )} />
</button>
```

**SessionStatusDialog no JSX (apos o AlertDialog existente):**
```typescript
<SessionStatusDialog
  open={statusDialogOpen}
  onOpenChange={(open) => {
    setStatusDialogOpen(open);
    if (!open && whatsappNumber && codAgent) {
      // Re-fetch para sincronizar status
      externalDb.getSessionStatus(whatsappNumber, codAgent)
        .then(result => setSessionData(result))
        .catch(console.error);
    }
  }}
  whatsappNumber={whatsappNumber}
  codAgent={codAgent}
/>
```

