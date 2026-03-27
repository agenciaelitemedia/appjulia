

# Correção da substituição [[ROTEIROS_CASOS]]

## Problema atual
A regex `CASO \d+:` não captura o formato real dos títulos que inclui emoji e nome do caso, como `### 🤕 CASO 1: AUXÍLIO-ACIDENTE`. O resultado é que a renumeração não funciona corretamente.

## Correção

Alterar a regex em `promptDefaults.ts` (linhas 142-152) para capturar o padrão completo `### .+ CASO \d+:` preservando o emoji e o texto antes de "CASO", e renumerando sequencialmente.

Nova regex: `/^(### .+ )CASO \d+:/gm` — captura o prefixo (ex: `### 🤕 `) e substitui apenas o número do CASO.

```typescript
// Scripts - qualification_script + negotiation_text with renumbered CASO N:
let scriptCounter = 0;
const scriptsText = cases
  .map(c => {
    const combined = [c.qualification_script, c.negotiation_text].filter(Boolean).join('\n\n');
    return combined.replace(/^(### .+ )CASO \d+:/gm, () => {
      scriptCounter++;
      return `### CASO ${scriptCounter}:`;
    }).replace(/(?<!### .+ )CASO \d+:/g, () => {
      return `CASO ${scriptCounter}:`;
    });
  })
  .join('\n\n---\n\n');
```

Abordagem simplificada: usar uma regex que capture qualquer ocorrência de `CASO \d+:` (com ou sem `### emoji`) e renumere tudo sequencialmente por caso (cada bloco de caso = 1 número):

```typescript
let scriptCounter = 0;
const scriptsText = cases
  .map(c => {
    scriptCounter++;
    const combined = [c.qualification_script, c.negotiation_text].filter(Boolean).join('\n\n');
    return combined.replace(/CASO \d+:/g, `CASO ${scriptCounter}:`);
  })
  .join('\n\n---\n\n');
```

Isso atribui o mesmo número a todas as ocorrências de "CASO N:" dentro do mesmo caso (qualification_script + negotiation_text), incrementando por caso adicionado.

## Arquivo modificado
| Arquivo | Alteracao |
|---|---|
| `src/pages/admin/prompts/constants/promptDefaults.ts` | Corrigir regex linhas 142-152 |

