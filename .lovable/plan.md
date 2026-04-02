

# Correção da Conexão SIP 3C+ — Problema da Porta WSS

## Diagnóstico Final

A investigação completa revelou o seguinte:

1. **As credenciais estão corretas** — o banco tem exatamente o que o painel 3C+ mostra:
   - Servidor SIP: `assessoria.3c.fluxoti.com`
   - Usuário: `SD9uLTKkWr`
   - Senha: `5ZzEvZpvrN`

2. **O problema é a URL WebSocket** — o sistema tenta `wss://assessoria.3c.fluxoti.com:8089/ws` mas essa porta/path não está acessível. A porta 8089 é o padrão de Asterisk local, mas a infraestrutura 3C+ (cloud/FluxoTI) provavelmente expõe o WebSocket em outra porta ou path.

3. **O "Ramal SIP externo" do painel 3C+** foi projetado para softphones desktop (Zoiper, MicroSIP) que usam SIP sobre UDP/TCP. No browser, o JsSIP só funciona com WebSocket (WSS).

4. **A documentação oficial da 3C+** indica que para WebRTC no browser, o método suportado é o iframe `/extension?api_token=...`. Mas é possível que o mesmo PBX exponha WSS em portas alternativas.

## Plano de Correção

### 1. Implementar descoberta automática de WSS com tentativa de múltiplas portas

No `useSipPhone.ts`, antes de conectar, tentar múltiplas URLs WSS em sequência até encontrar uma que aceite a conexão:

```text
Ordem de tentativa:
1. wss://assessoria.3c.fluxoti.com/ws          (porta 443, path /ws)
2. wss://assessoria.3c.fluxoti.com:443/ws       (explícito)
3. wss://assessoria.3c.fluxoti.com:8089/ws      (Asterisk padrão HTTPS)
4. wss://assessoria.3c.fluxoti.com:8088/ws      (Asterisk padrão HTTP/WSS)
5. wss://assessoria.3c.fluxoti.com:7443/ws      (alternativo common)
```

Cada tentativa abre um WebSocket raw com timeout de 3 segundos. A primeira que conectar com sucesso é usada para o JsSIP.

### 2. Pular o webphone login quando já temos credenciais

O sistema já tem username/password/domain cacheados. O webphone login retorna 403 porque o agente tem `webphone: false` (feature diferente do "SIP externo"). Ajustar o proxy para **não tentar** o webphone login quando as credenciais já existem no cache (já faz isso, mas o diagnóstico chama e confunde).

### 3. Mostrar tentativas no diagnóstico

Exibir no painel de diagnóstico qual URL WSS foi testada e qual funcionou (ou todas falharam), para dar visibilidade completa ao administrador.

### 4. Fallback: iframe invisível como último recurso

Se nenhuma porta WSS funcionar, oferecer a opção de usar o iframe do `/extension` da 3C+ de forma integrada (invisível, sem janela separada), já que é o único método oficialmente suportado pela 3C+ para WebRTC no browser. O iframe ficaria escondido (0x0), apenas mantendo o registro SIP ativo, enquanto o controle de chamadas continua pela API.

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/pages/telefonia/hooks/useSipPhone.ts` | Adicionar probe de WSS com múltiplas portas antes de conectar JsSIP |
| `src/pages/telefonia/components/DiscadorTab.tsx` | Mostrar porta testada/encontrada no diagnóstico |
| `supabase/functions/threecplus-proxy/index.ts` | Retornar lista de WSS URLs candidatas; não chamar webphone login quando cache existe |

## Resultado esperado

- O sistema testa automaticamente múltiplas portas WSS até encontrar a correta
- Se porta 443 funcionar (mais provável em cloud), a conexão SIP acontece normalmente
- Se nenhuma porta funcionar, o diagnóstico mostra claramente que o PBX da 3C+ não expõe WSS e sugere a alternativa do iframe integrado

