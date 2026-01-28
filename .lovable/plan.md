
# Análise de Complexidade: Trava de Leads com Contrato Gerado

## Resumo do Requisito

Implementar regra de negócio onde:
1. Leads com contrato gerado devem permanecer na etapa "Contrato em Curso"
2. A única movimentação permitida é para "Contrato Assinado"
3. A regra deve funcionar mesmo se novas etapas forem adicionadas no futuro

---

## Arquitetura Atual

### Como os Dados Estão Organizados

```text
+------------------------+     +---------------------------+
| crm_atendimento_cards  |     | vw_desempenho_julia_      |
|------------------------|     | contratos                 |
| id                     |     |---------------------------|
| cod_agent              |     | whatsapp (identifica lead)|
| whatsapp_number        |<--->| status_document           |
| stage_id               |     | (CREATED/SIGNED/etc)      |
| stage_entered_at       |     | cod_document              |
+------------------------+     +---------------------------+
         |
         v
+------------------------+
| crm_atendimento_stages |
|------------------------|
| id = 4 (Contrato em    |
|         Curso)         |
| id = 5 (Contrato       |
|         Assinado)      |
+------------------------+
```

### Ponto de Mudança de Etapa

O unico local onde leads mudam de etapa e no hook `useMoveCard` em:
- **Arquivo**: `src/pages/crm/hooks/useCRMData.ts`
- **Linhas**: 98-137

---

## Complexidade: MEDIA

A implementacao requer mudancas em **3 camadas**:

| Camada | Complexidade | Descricao |
|--------|--------------|-----------|
| Frontend | Baixa | Bloquear UI para etapas nao permitidas |
| Logica de Negocio | Media | Validar se lead tem contrato antes de mover |
| Dados | Baixa | Consulta para verificar se existe contrato |

---

## Desafios Identificados

### 1. Relacionamento Indireto (Complexidade Media)

Os leads (crm_atendimento_cards) e contratos (vw_desempenho_julia_contratos) se relacionam por:
- `whatsapp_number` no CRM
- `whatsapp` na view de contratos
- `cod_agent` em ambos

Nao existe FK direta entre eles.

### 2. Verificacao de Contrato (Complexidade Baixa)

Para cada movimentacao, precisamos verificar:
```sql
SELECT COUNT(*) 
FROM vw_desempenho_julia_contratos 
WHERE whatsapp = $1 
  AND cod_agent = $2
  AND status_document IN ('CREATED', 'PENDING', 'SIGNED')
```

### 3. Validacao no Frontend (Complexidade Baixa)

Desabilitar opcoes de movimentacao quando:
- Lead esta em "Contrato em Curso"
- E tem contrato associado
- E destino nao e "Contrato Assinado"

---

## Plano de Implementacao

### Etapa 1: Criar Hook para Verificar Contrato do Lead

**Arquivo novo**: `src/pages/crm/hooks/useLeadContract.ts`

```typescript
export function useLeadHasContract(whatsappNumber: string, codAgent: string) {
  return useQuery({
    queryKey: ['lead-contract', whatsappNumber, codAgent],
    queryFn: async () => {
      const result = await externalDb.raw<{ has_contract: boolean, is_signed: boolean }>({
        query: `
          SELECT 
            COUNT(*) > 0 as has_contract,
            COUNT(CASE WHEN status_document = 'SIGNED' THEN 1 END) > 0 as is_signed
          FROM vw_desempenho_julia_contratos 
          WHERE whatsapp = $1 
            AND cod_agent = $2
            AND status_document IN ('CREATED', 'PENDING', 'SIGNED')
        `,
        params: [whatsappNumber, codAgent],
      });
      return result[0] || { has_contract: false, is_signed: false };
    },
    enabled: !!whatsappNumber && !!codAgent,
  });
}
```

### Etapa 2: Adicionar Validacao no useMoveCard

**Arquivo**: `src/pages/crm/hooks/useCRMData.ts`

Modificar `useMoveCard` para:
1. Buscar informacoes do card atual (stage atual)
2. Verificar se o lead tem contrato
3. Bloquear movimentacao se:
   - Stage atual = "Contrato em Curso"
   - Lead tem contrato
   - Stage destino != "Contrato Assinado"

```typescript
export function useMoveCard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ cardId, toStageId, notes }: { 
      cardId: number; 
      toStageId: number; 
      notes?: string 
    }) => {
      // 1. Buscar card atual com whatsapp e stage
      const cards = await externalDb.raw<{ 
        stage_id: number; 
        whatsapp_number: string;
        cod_agent: string;
      }>({
        query: `
          SELECT c.stage_id, c.whatsapp_number, c.cod_agent
          FROM crm_atendimento_cards c
          WHERE c.id = $1
        `,
        params: [cardId],
      });
      
      const card = cards[0];
      if (!card) throw new Error('Card não encontrado');
      
      // 2. Buscar stages de contrato
      const stages = await externalDb.raw<{ id: number; name: string }>({
        query: `
          SELECT id, name FROM crm_atendimento_stages 
          WHERE name IN ('Contrato em Curso', 'Contrato Assinado')
        `,
        params: [],
      });
      
      const contratoEmCursoId = stages.find(s => s.name === 'Contrato em Curso')?.id;
      const contratoAssinadoId = stages.find(s => s.name === 'Contrato Assinado')?.id;
      
      // 3. Se esta em "Contrato em Curso", verificar se pode mover
      if (card.stage_id === contratoEmCursoId && toStageId !== contratoAssinadoId) {
        // Verificar se tem contrato
        const contracts = await externalDb.raw<{ count: number }>({
          query: `
            SELECT COUNT(*) as count
            FROM vw_desempenho_julia_contratos 
            WHERE whatsapp = $1 
              AND cod_agent = $2
              AND status_document IN ('CREATED', 'PENDING', 'SIGNED')
          `,
          params: [card.whatsapp_number, card.cod_agent],
        });
        
        if (contracts[0]?.count > 0) {
          throw new Error(
            'Este lead possui contrato gerado e só pode ser movido para "Contrato Assinado"'
          );
        }
      }
      
      // 4. Continuar com a movimentacao normal
      await externalDb.update({
        table: 'crm_atendimento_cards',
        data: {
          stage_id: toStageId,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        where: { id: cardId },
      });
      
      await externalDb.insert({
        table: 'crm_atendimento_history',
        data: {
          card_id: cardId,
          from_stage_id: card.stage_id,
          to_stage_id: toStageId,
          changed_by: user?.name || 'Sistema',
          changed_at: new Date().toISOString(),
          notes: notes || null,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-cards'] });
      queryClient.invalidateQueries({ queryKey: ['crm-card-history'] });
    },
  });
}
```

### Etapa 3: Feedback Visual no Frontend

**Arquivo**: `src/pages/crm/components/CRMLeadDetailsDialog.tsx`

Adicionar indicador visual quando lead tem contrato e esta travado:
- Badge "Contrato Gerado" no modal
- Mensagem explicando que so pode ir para "Contrato Assinado"

---

## Resumo de Arquivos a Modificar

| Arquivo | Acao | Complexidade |
|---------|------|--------------|
| `src/pages/crm/hooks/useCRMData.ts` | Adicionar validacao no `useMoveCard` | Media |
| `src/pages/crm/hooks/useLeadContract.ts` | Criar hook (opcional, para UI) | Baixa |
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Adicionar feedback visual | Baixa |

---

## Consideracoes Futuras

### Automatizacao (Opcional)

Se desejado, podemos adicionar logica para:
- Automaticamente mover lead para "Contrato em Curso" quando contrato e gerado
- Automaticamente mover para "Contrato Assinado" quando status_document = 'SIGNED'

Isso requer **webhook** ou **cron job** para monitorar mudancas na view de contratos.

---

## Estimativa de Esforco

| Fase | Tempo Estimado |
|------|----------------|
| Implementacao basica (validacao) | 30-45 min |
| Feedback visual (UI) | 15-20 min |
| Testes e ajustes | 15-20 min |
| **Total** | **1-1.5 horas** |

---

## Riscos e Mitigacoes

| Risco | Mitigacao |
|-------|-----------|
| Relacionamento por whatsapp pode ter duplicados | Adicionar cod_agent na validacao |
| View de contratos pode nao ter dados historicos | Validar apenas contratos ativos |
| Performance em muitas movimentacoes | Cache de verificacao de contrato |

