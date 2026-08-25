# Corrigir aba Telefonia: ligações VoIP não aparecem no contato

## Diagnóstico (confirmado no banco)

Existem 6 ligações VoIP para esse contato (client_id 300, dias 24 e 25/08), mas elas nunca aparecem na aba **Voip Call**.

Motivo: os formatos de número não batem.

- Em `phone_call_logs`, o destino é gravado em formato **nacional**: `075983342048` (0 + DDD + 9 dígitos, 12 caracteres). Toda a tabela segue esse padrão, e `caller` é sempre o **ramal** (4 dígitos, ex. `1125`) — não há número de cliente em `caller`.
- O hook `useContactVoipCalls` filtra com igualdade exata contra as variantes internacionais do contato (`5579…` com 12/13 dígitos) em `caller`/`called`. Nenhuma variante começa com `0`, então o resultado é sempre vazio.
- A aba **ZAP Call** (`wavoip_call_logs`) usa `5584…` com 12 dígitos, compatível com as variantes atuais — essa parte funciona e não deve ser alterada.

## Correção

Em `src/hooks/useContactCallHistory.ts`, ajustar apenas a consulta VoIP:

1. Derivar os **8 últimos dígitos** do telefone do contato (parte local sem o 9º dígito), que é estável entre os formatos `55DDD9XXXXXXXX` e `0DDD9XXXXXXXX`.
2. Filtrar por sufixo: `called.like.%<8digitos>` OR `caller.like.%<8digitos>` (mantendo `client_id` e o limite de 100), em vez de `in.(variantes)`.
3. Manter a ordenação por `started_at desc` e o restante do componente `ChatContactCallsPanel` intacto.

Sem mudanças de banco, sem alteração no ZAP Call.

## Detalhe técnico

- Novo helper local `localSuffix8(phone)` no próprio hook: remove não-dígitos, tira DDI `55`/`0` inicial e retorna os 8 últimos dígitos; se houver menos de 8 dígitos, o query fica desabilitado.
- O sufixo de 8 dígitos pode, em teoria, colidir entre DDDs diferentes; para evitar falso positivo, o filtro continua restrito ao `client_id` e o resultado é filtrado no cliente comparando também o DDD (`called` contendo o DDD do contato).
