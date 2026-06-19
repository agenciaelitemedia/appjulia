# Salvar CTAs em `settings.START_CAMPAIGN` ao publicar

Ao publicar um prompt em `/admin/prompts` (aba Implantação), além de gravar o `prompt`, também sobrescrever a chave `START_CAMPAIGN` dentro do JSON `settings` do agente com todas as CTAs dos casos vinculados, concatenadas por `||`.

## Mudanças

**`src/pages/admin/prompts/components/PromptsTab.tsx`** (`handlePublish`)
- Após montar `safeSettings`, calcular:
  ```ts
  const allCtas = (viewCases ?? [])
    .flatMap(c => Array.isArray(c.ctas) ? (c.ctas as string[]) : [])
    .map(s => String(s ?? '').trim())
    .filter(Boolean);
  safeSettings.START_CAMPAIGN = allCtas.join('||');
  ```
- Passar esse `safeSettings` atualizado no `externalDb.updateAgent`. Substitui completamente o valor anterior de `START_CAMPAIGN` (mesmo se a lista vier vazia, grava string vazia).

**`src/pages/admin/prompts/components/wizard/StepFinalPrompt.tsx`** (`handlePublish`)
- Mesma lógica, usando `cases` (prop já existente no componente — array de casos do wizard com `ctas`). Garante paridade entre publicar pelo wizard e publicar pelo dialog de visualização.

## Sem mudanças
- Estrutura do JSON `settings`, demais chaves preservadas.
- Schema, RLS, edge functions — nada disso é tocado.
- UI — nenhuma alteração visual; comportamento do botão "Publicar" continua igual, só passa a gravar `START_CAMPAIGN` junto.
