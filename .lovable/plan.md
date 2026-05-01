## Objetivo
Eliminar o caso em que o chat entra com a lista/contadores carregados, mas a conversa fica sem mensagens até sair e voltar da página. Também vou tornar o carregamento inicial e o “carregar mensagens anteriores” mais previsíveis e resilientes.

## O que vou corrigir
1. Introduzir um estado explícito de prontidão do contexto do chat para separar:
   - bootstrap da página
   - lista de conversas pronta
   - conversa selecionada pronta para hidratar mensagens
2. Ajustar a hidratação inicial de `ChatMessages` para não depender só de `contactId`.
   - o carregamento inicial vai reexecutar quando o contexto terminar de resolver cliente/filas/conversas
   - não vai marcar “primeira carga concluída” cedo demais quando a fonte ainda não estiver pronta
3. Proteger a seleção da conversa durante o bootstrap.
   - evitar montagem do painel de mensagens em estado intermediário
   - manter a seleção estável enquanto a lista e as conversas terminam de sincronizar
4. Corrigir a recuperação automática do cache de mensagens.
   - hoje ela tenta reidratar só em parte dos cenários
   - vou cobrir também quando existe contato selecionado, mas o bucket local ainda está vazio ou foi sobrescrito por refresh silencioso
5. Reforçar a UX de carregamento no painel de conversa.
   - skeleton consistente enquanto a conversa ainda está “hidratando”
   - estado vazio só quando realmente não existirem mensagens
   - fallback manual de recarga mais confiável
6. Revisar o gatilho do histórico/paginação antiga para não depender de um estado inicial inconsistente.

## Arquivos que serão alterados
- `src/contexts/WhatsAppDataContext.tsx`
- `src/components/chat/ChatMessages.tsx`
- `src/components/chat/ChatContainer.tsx`
- `src/pages/chat/ChatPage.tsx`

## Resultado esperado
- Ao entrar em `/chat`, a conversa abre com as mensagens corretamente na primeira vez.
- O usuário não precisa sair e voltar da tela para ver o conteúdo.
- O histórico antigo volta a carregar já na primeira abertura.
- A experiência fica mais estável mesmo com carregamento assíncrono de filas, permissões e conversas.

## Detalhes técnicos
- O problema principal está no sincronismo entre o bootstrap do `WhatsAppDataContext` e o efeito inicial de `ChatMessages`.
- Hoje o painel de mensagens pode disparar fetch cedo demais, enquanto cliente/filas/conversas ainda estão estabilizando, e como o efeito depende basicamente de `contactId`, ele não necessariamente reexecuta quando o contexto finalmente fica pronto.
- Também existe risco de o painel assumir “primeira página carregada” num momento em que o bucket local ainda não representa o estado final da conversa.
- Vou alinhar a montagem do painel e o fetch inicial a uma condição de prontidão real do contexto, além de tornar a reidratação idempotente e segura contra resets silenciosos.

## Validação
Vou validar estes cenários após implementar:
1. Entrar direto em `/chat` com conversa selecionada.
2. Abrir uma conversa na aba “Em Abertos”.
3. Trocar para “Em Atendimento” e voltar.
4. Confirmar que as mensagens aparecem sem navegar para outra página.
5. Confirmar que “Carregar mensagens anteriores” funciona já na primeira abertura.
6. Confirmar que refresh silencioso do contexto não apaga a conversa visível.