

# Melhorias no Visualizar e Auto-geração de Palavras Semânticas

## 1. Dialog de Visualizar — Adicionar info do ZapSign e Casos

No `PromptsTab.tsx`, antes do textarea do prompt final, adicionar:

- **Card cinza** com link completo do ZapSign montado a partir dos tokens dos casos (ex: `https://app.zapsign.com.br/verificar/DOC_TOKEN`). Cada caso que tiver `zapsign_doc_token` mostra seu link. Card com `bg-muted` 100% largura.
- **Lista de casos** do prompt com seus CTAs em formato de badges/chips abaixo de cada caso.

Para isso, o `openView` já busca os cases via `fetchCases` e armazena em `viewCases`. Basta renderizar esses dados no dialog.

### Estrutura visual
```text
┌─────────────────────────────────────────┐
│  Card cinza (bg-muted rounded p-4)      │
│  🔗 ZapSign Links:                      │
│  Caso 1: https://app.zapsign.com.br/... │
│  Caso 2: https://app.zapsign.com.br/... │
└─────────────────────────────────────────┘

Casos vinculados:
┌─────────────────────────────────────────┐
│ AUXÍLIO-ACIDENTE                        │
│ [CTA 1] [CTA 2] [CTA 3]               │
├─────────────────────────────────────────┤
│ SALÁRIO-MATERNIDADE                     │
│ [CTA 1] [CTA 2]                        │
└─────────────────────────────────────────┘

Prompt Final Gerado:
[textarea readonly com o prompt]
```

## 2. Auto-geração de Palavras Semânticas ao adicionar caso

No `StepCaseSelect.tsx`, na função `addCase`:

- Quando um caso é adicionado, extrair automaticamente 5 palavras-chave relevantes do campo `case_info` do caso jurídico.
- Lógica local simples: analisar o texto do `case_info` e gerar palavras no formato `"palavra1", "palavra2", ... → Nome do Caso`.
- Abordagem: usar heurística local — pegar substantivos/termos relevantes do texto (excluindo stopwords comuns em português) e selecionar os 5 mais representativos. Isso evita chamada de API e funciona instantaneamente.
- O campo `semantic_words` do `CaseData` será pré-preenchido com essas palavras, editável pelo usuário depois na personalização.

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| `PromptsTab.tsx` | Adicionar card ZapSign + lista de casos com CTAs no dialog de visualização |
| `StepCaseSelect.tsx` | Auto-gerar 5 palavras semânticas ao adicionar caso via extração de keywords do `case_info` |

