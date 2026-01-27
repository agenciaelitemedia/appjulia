
# Plano: Adicionar Exclusao de Instancia e Ajustar Webhook

## Resumo

Este plano adiciona um botao de exclusao de instancia ao lado do botao "Conectar" na pagina "Meus Agentes", com um dialog de confirmacao seguro que exige que o usuario digite o nome da instancia e marque um checkbox de confirmacao. Alem disso, remove o campo `wasSentByApi` da configuracao do webhook.

## Mudancas Necessarias

### 1. Atualizar Edge Function - Remover wasSentByApi do Webhook

**Arquivo:** `supabase/functions/uazapi-admin/index.ts`

Localizar a linha 153 e alterar o array `excludeMessages`:

| Antes | Depois |
|-------|--------|
| `excludeMessages: ['wasSentByApi', 'isGroupYes']` | `excludeMessages: ['isGroupYes']` |

### 2. Criar Hook useDeleteInstance

**Novo arquivo:** `src/pages/agente/meus-agentes/hooks/useDeleteInstance.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserAgent } from '../types';

interface DeleteInstanceParams {
  agent: UserAgent;
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ agent }: DeleteInstanceParams) => {
      if (!agent.evo_instancia || !agent.agent_id_from_agents) {
        throw new Error('Instancia ou ID do agente nao encontrado');
      }

      const { data, error } = await supabase.functions.invoke('uazapi-admin', {
        body: {
          action: 'delete_instance',
          instanceName: agent.evo_instancia,
          agentId: agent.agent_id_from_agents,
        },
      });

      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success('Instancia excluida com sucesso');
      queryClient.invalidateQueries({ queryKey: ['user-agents'] });
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir instancia', { description: error.message });
    },
  });

  return {
    deleteInstance: mutation.mutate,
    deleteInstanceAsync: mutation.mutateAsync,
    isDeleting: mutation.isPending,
    reset: mutation.reset,
  };
}
```

### 3. Criar Componente DeleteInstanceDialog

**Novo arquivo:** `src/pages/agente/meus-agentes/components/DeleteInstanceDialog.tsx`

Componentes do dialog:
- Campo de texto com nome da instancia para copiar (readonly, com botao copiar)
- Campo de input para digitar o nome da instancia (validacao exata)
- Checkbox de confirmacao final
- Botao de exclusao desabilitado ate validacao completa

```text
+------------------------------------------+
|  Excluir Instancia                       |
+------------------------------------------+
|  ATENCAO: Esta acao e irreversivel!      |
|                                          |
|  Instancia a ser excluida:               |
|  +------------------------------------+  |
|  | [JulIAv2][001] - Cliente   [Copiar]|  |
|  +------------------------------------+  |
|                                          |
|  Digite o nome da instancia:             |
|  +------------------------------------+  |
|  |                                    |  |
|  +------------------------------------+  |
|                                          |
|  [ ] Confirmo que desejo excluir         |
|                                          |
|  [Cancelar]        [Excluir Instancia]   |
+------------------------------------------+
```

### 4. Atualizar ConnectionControlButtons

**Arquivo:** `src/pages/agente/meus-agentes/components/ConnectionControlButtons.tsx`

**Mudancas:**
1. Adicionar import do icone `Trash2` do lucide-react
2. Adicionar import do `DeleteInstanceDialog`
3. Adicionar import do `useDeleteInstance` hook
4. Adicionar estado `deleteDialogOpen`
5. No caso `disconnected`, alterar layout para flex row com dois botoes:
   - Botao "Conectar" (existente, mas menor)
   - Botao icone vermelho de lixeira (novo)

**Layout visual para status `disconnected`:**

```text
+----------------------------------+
| [QrCode] Conectar    [Lixeira]   |
+----------------------------------+
```

**Codigo ajustado no case 'disconnected':**

```tsx
case 'disconnected':
  return (
    <>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            connect();
            setQrDialogOpen(true);
          }}
          disabled={isConnecting}
          className="flex-1 bg-primary hover:bg-primary/90"
        >
          {isConnecting ? <Loader2 className="animate-spin" /> : <QrCode />}
          Conectar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDeleteDialogOpen(true)}
          className="border-destructive text-destructive hover:bg-destructive hover:text-white"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <QRCodeDialog ... />
      <DeleteInstanceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        agent={agent}
        onSuccess={handleDeleteSuccess}
      />
    </>
  );
```

## Fluxo de Exclusao

```text
1. Usuario clica no icone de lixeira
2. Abre DeleteInstanceDialog
3. Dialog mostra nome da instancia com botao copiar
4. Usuario digita nome exato da instancia
5. Usuario marca checkbox de confirmacao
6. Botao "Excluir" fica habilitado
7. Usuario clica em "Excluir"
8. Frontend chama Edge Function (delete_instance)
9. Edge Function deleta no UaZapi + limpa banco
10. Dialog fecha e lista de agentes e atualizada
```

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `supabase/functions/uazapi-admin/index.ts` | Modificar | Remover `wasSentByApi` do webhook |
| `src/pages/agente/meus-agentes/hooks/useDeleteInstance.ts` | Criar | Hook para exclusao de instancia |
| `src/pages/agente/meus-agentes/components/DeleteInstanceDialog.tsx` | Criar | Dialog de confirmacao segura |
| `src/pages/agente/meus-agentes/components/ConnectionControlButtons.tsx` | Modificar | Adicionar botao de exclusao |

## Detalhes Tecnicos

### Validacao do Dialog

O botao de exclusao so sera habilitado quando:
1. O texto digitado for identico ao nome da instancia (`agent.evo_instancia`)
2. O checkbox estiver marcado

### Componentes Utilizados

- `Dialog` do Radix UI (existente)
- `Input` para digitacao
- `Checkbox` para confirmacao
- `Button` com icone `Copy` para copiar
- Toast para feedback
