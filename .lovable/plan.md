## Problema

A edge function `zapsign-file` baixa apenas o arquivo principal (`signed_file` / `original_file`) retornado pela API do ZapSign. Quando o contrato tem **documentos complementares** (campo `extra_docs` na resposta da API `GET /api/v1/docs/{doc_token}/`), eles são ignorados e o usuário recebe só o PDF principal.

A API do ZapSign expõe os anexos assim:
```json
{
  "token": "...",
  "name": "Contrato Principal",
  "signed_file": "https://.../main_signed.pdf",
  "original_file": "https://.../main.pdf",
  "extra_docs": [
    { "token": "...", "name": "Procuração", "signed_file": "...", "original_file": "..." },
    { "token": "...", "name": "RG",          "signed_file": "...", "original_file": "..." }
  ]
}
```

## Solução

Empacotar o documento principal + todos os `extra_docs` em um único **ZIP** no servidor e devolver ao frontend. Mantém compatibilidade: se não houver extras, segue baixando apenas o PDF (comportamento atual).

### 1. `supabase/functions/zapsign-file/index.ts`
- Após resolver `docData`, montar lista de arquivos: principal + cada item de `docData.extra_docs ?? []`.
- Para cada arquivo, escolher `signed_file` (fallback para `original_file`) conforme o parâmetro `file`.
- Se a lista tiver **1 só item** → manter o comportamento atual (stream do PDF direto, mesmo header `Content-Disposition`).
- Se tiver **2+ itens**:
  - Baixar todos em paralelo (`Promise.all` com `fetch`).
  - Usar a lib `jszip` via `npm:jszip@3` para gerar o ZIP em memória.
  - Nomear cada entrada como `${index+1} - ${nome_sanitizado}.pdf` (deduplicar nomes iguais com sufixo).
  - Retornar com `Content-Type: application/zip` e `Content-Disposition: attachment; filename="<docName>.zip"`.
- Manter o envelope JSON de erro atual (status 200 + `{success:false,error}`) para falhas de validação/credencial.
- Logar quantidade de extras e tamanho final do zip.

### 2. Frontend — nenhum ajuste obrigatório
Os três call-sites (`ContractInfoContent.tsx`, `CRMLeadDetailsDialog.tsx`, `ContratosTable.tsx`, `ContratoDetailsDialog.tsx`) já fazem:
```ts
const blob = await response.blob();
// usa Content-Disposition do header pra nomear
```
Como o backend continuará setando `Content-Disposition` correto (`.pdf` ou `.zip`), o download funciona automaticamente. Apenas vou ajustar o fallback de nome local em cada um para respeitar a extensão devolvida (não forçar `.pdf` quando o header trouxer `.zip`), evitando salvar `contrato.pdf` contendo um zip.

### 3. Deploy
Redeploy de `zapsign-file` após a edição.

## Arquivos a alterar
- `supabase/functions/zapsign-file/index.ts` (lógica principal)
- `src/pages/crm/components/ContractInfoContent.tsx` (fallback de extensão)
- `src/pages/crm/components/CRMLeadDetailsDialog.tsx` (fallback de extensão)
- `src/pages/estrategico/contratos/components/ContratosTable.tsx` (fallback de extensão)
- `src/pages/estrategico/contratos/components/ContratoDetailsDialog.tsx` (fallback de extensão)

## Fora de escopo
- Mudar UI para listar arquivos individualmente (pode ser feito depois se preferir baixar 1 a 1 em vez de zip).
- Cache do zip / armazenamento em storage.
