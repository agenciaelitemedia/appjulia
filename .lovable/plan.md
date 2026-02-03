
## O que está acontecendo (causa real)
Pelos requests que aparecem no navegador, o app está tentando sincronizar chamando diretamente a API externa:

- `POST https://api.masterchat.com.br/chat/find`
- e o navegador retorna **“Failed to fetch”** (sem status HTTP)

Isso normalmente acontece quando a API externa **bloqueia CORS** (ou seja, não permite chamadas direto do browser, especialmente com header customizado `token`).  
Resultado:
- o botão “sincronizar” sempre falha ⇒ toast “Erro ao sincronizar contatos”
- como não vem nenhum contato, a tela fica “estranha/vazia”, parecendo desconfigurada

**Do I know what the issue is?** Sim: a sincronização falha porque a API do WhatsApp está sendo chamada pelo browser e o browser está bloqueando (CORS / network-level failure). A correção é fazer essas chamadas pelo backend (proxy), não direto do front.

---

## Objetivo da correção
1) Fazer a sincronização funcionar de forma confiável (sem CORS), usando uma **função de backend como proxy**.  
2) Melhorar a experiência quando falhar (mostrar mensagem útil e não “quebrar” a UI).  
3) Ajustar pequenos detalhes de layout para evitar overflow/horizontal scroll quando não há conversa.

---

## Mudanças propostas (alto nível)
### A) Criar um “proxy” de UaZapi no backend
Criar uma função de backend (Lovable Cloud) por exemplo: `uazapi-proxy` que:
- Recebe `{ method, endpoint, body, token }`
- Faz `fetch` server-side para `UAZAPI_BASE_URL + endpoint` com header `token`
- Retorna o JSON e o status
- Inclui CORS permissivo para o front

Isso remove o CORS do caminho porque o browser não chama mais `api.masterchat.com.br` diretamente.

### B) Fazer o UaZapiClient usar esse proxy por padrão
Hoje `src/lib/uazapi/client.ts` chama `fetch(url)` direto do browser. Vamos:
- Adicionar uma opção no client tipo `transport: 'direct' | 'proxy'` (default `proxy`)
- Quando `proxy`, usar `supabase.functions.invoke('uazapi-proxy', ...)` (chamada interna do projeto)

Assim **todas** as telas que usam `UaZapiClient` param de funcionar (Chat e também “Meus Agentes”, QR code, status etc).

### C) Atualizar todos os pontos que instanciam UaZapiClient
Encontramos instâncias em:
- `src/contexts/UaZapiContext.tsx`
- `src/pages/agente/meus-agentes/hooks/useConnectionActions.ts`
- `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts`
- `src/pages/agente/meus-agentes/hooks/useQRCodePolling.ts`
- `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

Todas precisam usar o modo `proxy` (ou apenas confiar no default).

### D) Melhorias de UX na sincronização do Chat
Em `WhatsAppDataContext.syncContacts` e na UI do `ChatList`:
- Exibir erro mais claro quando falhar, por exemplo:
  - “Não foi possível conectar ao servidor do WhatsApp. Verifique se a instância está conectada e tente novamente.”
- Evitar “spam” de toast quando houver retries (ex.: mostrar 1 toast por tentativa do usuário, não por retry interno)
- Manter o estado vazio com CTA (o “Clique em sincronizar…”) mas, quando erro, exibir também uma dica/alerta inline.

### E) Ajuste de layout (para “tela deformada”)
Mesmo que a principal “deformação” venha da ausência de dados, vamos blindar layout para não gerar overflow:
- Em `src/pages/chat/ChatPage.tsx`:
  - Garantir `w-full` e `overflow-hidden`
  - Revisar o uso de `-m-4 sm:-m-6` (pode causar “vazamento” horizontal dependendo do viewport). Se necessário, trocar por um layout sem margem negativa e com altura calculada correta.
- Em `src/components/chat/ChatContainer.tsx`:
  - Fixar largura do painel esquerdo no desktop com `lg:w-80 lg:max-w-80 lg:flex-none`
  - Garantir `min-w-0` e `overflow-hidden` no container pai para não empurrar o painel direito para fora.

---

## Passo a passo de implementação (sequência)
1) **Criar função de backend `uazapi-proxy`**
   - Arquivo novo: `supabase/functions/uazapi-proxy/index.ts`
   - Ler `UAZAPI_BASE_URL` do ambiente
   - Implementar:
     - `OPTIONS` (preflight) com CORS
     - `POST` com payload `{ method, endpoint, body, token }`
     - Validar `endpoint` (whitelist simples) para reduzir risco (ex.: só permitir rotas começando com `/chat/`, `/message/`, `/send/`, `/instance/`, `/labels/`, `/group/`, `/call/`)
     - Retornar status e body

2) **Atualizar `UaZapiClient` para suportar transporte via proxy**
   - Editar: `src/lib/uazapi/client.ts`
   - Adicionar no config: `transport?: 'direct' | 'proxy'`
   - Se `proxy`:
     - usar `supabase.functions.invoke('uazapi-proxy', { body: { method, endpoint, body, token }})`
     - mapear erros retornados para `UaZapiError` com status e payload

3) **Atualizar todos os lugares que criam `new UaZapiClient(...)`**
   - Definir `transport: 'proxy'` (ou confiar no default se adotarmos default=proxy)
   - Arquivos:
     - `src/contexts/UaZapiContext.tsx`
     - `src/pages/agente/meus-agentes/hooks/useConnectionActions.ts`
     - `src/pages/agente/meus-agentes/hooks/useConnectionStatus.ts`
     - `src/pages/agente/meus-agentes/hooks/useQRCodePolling.ts`
     - `src/pages/crm/components/WhatsAppMessagesDialog.tsx`

4) **Refinar mensagens de erro e comportamento de retry no Chat**
   - Editar: `src/contexts/WhatsAppDataContext.tsx`
   - Ao capturar erro de sync, diferenciar:
     - timeout
     - 401/403 (token inválido)
     - 5xx (instabilidade)
     - network/CORS (agora deve desaparecer)
   - Ajustar toast para não repetir em cada retry interno.

5) **Ajustes de layout**
   - Editar:
     - `src/pages/chat/ChatPage.tsx`
     - `src/components/chat/ChatContainer.tsx`
     - (opcional) `src/components/chat/ChatList.tsx` para remover borda duplicada e manter consistência visual

---

## Como vamos validar (checklist de testes)
1) Abrir `/chat` e clicar em **Sincronizar**:
   - Deve carregar contatos (sem “Failed to fetch”)
   - Não deve aparecer toast de erro
2) Clicar em um contato:
   - Deve carregar mensagens (cache + histórico)
3) Enviar uma mensagem de texto:
   - Deve aparecer otimisticamente e confirmar “sent”
4) Testar responsividade:
   - Janela < 1024px (tablet): lista ocupa tela inteira; ao abrir conversa, chat ocupa tela (com botão voltar)
5) Se a API estiver realmente fora do ar:
   - Deve aparecer um erro claro e acionável (não só “Erro ao sincronizar contatos”)

---

## Observações técnicas (para ficar registrado)
- O erro “Failed to fetch” é típico de CORS/preflight falhando no browser (principalmente por header custom `token`).
- A solução padrão é **proxy server-side** (função de backend).
- Isso também beneficia outras áreas do sistema que usam `UaZapiClient` (status, QR code, conectar/desconectar).

---

## Se ainda falhar depois do proxy
Aí o problema deixa de ser CORS e passa a ser:
- token inválido / instância desconectada
- indisponibilidade real da API externa
- endpoint diferente do esperado

Nesse caso, vamos adicionar logs controlados (no backend) e retornar a mensagem exata da API para a interface, para diagnóstico rápido.

Referência de troubleshooting (caso precise): https://docs.lovable.dev/tips-tricks/troubleshooting
