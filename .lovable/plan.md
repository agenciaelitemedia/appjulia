

# Melhorar Experiência de Discagem na Telefonia (Api4Com)

## Problemas identificados

1. **Softphone não aparece durante a discagem**: O `SoftphoneWidget` retorna `null` quando `status === 'idle'` (linhas 95-96), mas `setShowSoftphone(true)` só é chamado APÓS o sucesso da chamada API. Durante o período de espera (isDialing), nada visual aparece.

2. **Erros silenciosos**: Se a chamada API falha, `showSoftphone` nunca é setado — o usuário vê apenas um toast que desaparece rápido.

3. **Sem tela intermediária de "discando"**: Entre clicar "Ligar" e a chamada SIP chegar, não há feedback visual significativo.

## Solução

### 1. `PhoneContext.tsx` — Mostrar softphone ANTES da chamada API

- Mover `setShowSoftphone(true)` para ANTES do `supabase.functions.invoke`
- Criar estado `dialError` para quando a chamada API falha
- Não esconder o softphone em caso de erro — deixar o widget mostrar o erro

### 2. `SoftphoneWidget.tsx` — Tela de discagem rica e visível

- **Não retornar null em modo centered** mesmo com status idle — mostrar tela de "Conectando..."
- Adicionar suporte a props `isDialing` e `dialError`
- Estados visuais claros:
  - **Discando (API)**: Animação de pulso, ícone de telefone, "Conectando chamada..."
  - **Chamando (SIP calling)**: "Chamando...", botão desligar
  - **Tocando (ringing)**: Botão atender + desligar
  - **Em chamada**: Timer + controles (mudo, espera, DTMF)
  - **Erro**: Mensagem do erro + botão "Tentar novamente" + botão "Fechar"
- Botão de cancelar/fechar sempre visível quando não em chamada ativa
- Layout maior e mais claro no modo centered (nome do contato grande, status em destaque)

### 3. `MainLayout.tsx` — Passar novas props ao GlobalSoftphone

- Passar `isDialing` e `dialError` do PhoneContext para o SoftphoneWidget
- Usar `React.forwardRef` no SoftphoneWidget para eliminar o warning de console

### 4. `DiscadorTab.tsx` — Feedback melhorado

- Desabilitar pad inteiro durante discagem
- Status visual no campo de número durante chamada

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/contexts/PhoneContext.tsx` | `setShowSoftphone(true)` antes da API; novo estado `dialError`; retry |
| `src/pages/telefonia/components/SoftphoneWidget.tsx` | Tela de discagem rica; suporte a isDialing/dialError; forwardRef; não esconder em centered+idle |
| `src/components/layout/MainLayout.tsx` | Passar `isDialing`/`dialError` ao widget |

