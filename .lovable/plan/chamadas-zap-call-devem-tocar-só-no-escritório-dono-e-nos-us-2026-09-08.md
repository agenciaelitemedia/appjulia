# Chamadas ZAP Call devem tocar só no escritório dono e nos usuários autorizados

## O que encontrei (verificado no código e no banco)

A escolha de quais aparelhos ficam "escutando" chamadas já é filtrada por escritório e por usuário (aparelho do próprio usuário ou compartilhado com ele). O problema não é o filtro — é que o telefone virtual da Wavoip **guarda os aparelhos habilitados no navegador** e nem sempre solta os antigos:

1. **Troca de usuário sem recarregar a página.** Se o telefone virtual já foi iniciado, o código sai antes de limpar a memória do navegador, e os aparelhos do usuário anterior continuam habilitados — tocando para quem não deveria.
2. **Escritório sem plano ativo não limpa nada.** A rotina que remove aparelhos não permitidos só roda quando o escritório tem plano ativo; sem plano, ela retorna antes e os aparelhos herdados seguem tocando.
3. **Botão do próprio painel da Wavoip.** As configurações do telefone virtual mantêm o botão "habilitar aparelhos", que lista aparelhos da conta Wavoip (conta compartilhada entre escritórios) — habilitar por ali passa por cima da nossa tabela de permissão e fica salvo no navegador.
4. **Perda de permissão não desliga o toque.** Se o compartilhamento é revogado ou o aparelho troca de dono, nada revisa isso enquanto a página não é recarregada.
5. **Membros de equipe podem ficar sem aparelho nenhum.** O escritório é lido apenas de `user.client_id`, sem o `resolveEffectiveClientId`; quem herda o escritório do titular fica sem nada (efeito inverso, mas da mesma origem). No banco, o escritório 30 tem 3 aparelhos sem dono definido.

## Correção proposta

1. **Lista de permitidos como única verdade.** Criar uma rotina de sincronização que, sempre que a lista muda (e a cada verificação periódica já existente), compare os aparelhos habilitados no telefone virtual com a lista permitida e **desabilite/remova tudo que não está nela** — inclusive quando o escritório não tem plano ativo (nesse caso, remove todos).
2. **Limpar ao trocar de usuário.** Rodar essa limpeza também quando o telefone virtual já existe (hoje o código sai antes) e ao sair da conta, além de limpar a memória do navegador com a lista permitida atualizada.
3. **Fechar o atalho da Wavoip.** Desligar o botão "habilitar aparelhos" nas configurações do telefone virtual, para que só o painel Aparelhos (que respeita permissão) controle o que toca.
4. **Reagir a mudanças de permissão em tempo real.** Assinar mudanças em aparelhos e em compartilhamentos e refazer a sincronização — revogar acesso passa a parar o toque na hora.
5. **Escritório efetivo.** Usar `resolveEffectiveClientId` para membros de equipe, para que herdem corretamente o escritório do titular.

## Verificação

- Com dois usuários do mesmo escritório: chamada no aparelho de A não toca em B (sem compartilhamento) e toca em B quando compartilhado.
- Trocar de usuário na mesma aba e confirmar que o aparelho anterior para de tocar sem recarregar.
- Revogar compartilhamento com a chamada chegando: o segundo usuário para de receber.
- Escritório sem plano: nenhum aparelho habilitado.

## Detalhes técnicos

- `src/contexts/WavoipContext.tsx`: extrair `syncSdkDevices(allowedTokens)` (add/enable dos permitidos + disable/remove do resto + `pruneSdkDeviceCache`), chamar no mount mesmo com `active === false`, no `refreshDevices`, no loop de reconciliação (10s) e ao mudar `user.id`; remover o early-return sem limpeza em `ensureWebphone`; `showEnableDevicesButton: false`.
- Assinaturas realtime em `wavoip_devices` (por `client_id`) e `wavoip_device_members` (por `app_user_id`) disparando `refreshDevices`.
- `clientId` via `resolveEffectiveClientId` (`src/lib/resolveEffectiveClientId.ts`), com o mesmo padrão usado nos outros módulos.
- Sem mudanças de banco.
