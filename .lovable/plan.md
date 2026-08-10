# Limpar os avisos do console e confirmar a tela de Agentes

## O que o log mostra

O arquivo enviado tem 3.886 linhas, mas todas são de dois tipos de **aviso** (nenhum erro funcional):

1. `Function components cannot be given refs` — repetido para `PhoneProvider`, `Login` e `DebugBar`.
2. `React Router Future Flag Warning` — avisos de mudanças previstas na versão 7 do React Router.

O erro `Failed to fetch dynamically imported module .../AgentsPage.tsx` foi consequência do recarregamento após a última publicação (chunk antigo em cache). O módulo já responde normalmente (HTTP 200) no servidor atual, então não há quebra na tela de Agentes.

## O que fazer

### 1. Silenciar os avisos de ref (3 componentes)
Nenhum código do projeto passa `ref` para esses componentes — o `ref` vem do overlay de desenvolvimento do preview. A correção é tornar os componentes tolerantes a `ref`:

- `src/contexts/PhoneContext.tsx` → `PhoneProvider` encapsulado em `React.forwardRef`, repassando o ref para o elemento raiz (ou ignorando-o quando não houver DOM próprio).
- `src/pages/Login.tsx` → mesmo tratamento no componente de página.
- `src/components/debug/DebugBar.tsx` → mesmo tratamento.

Nenhuma mudança de comportamento, layout ou lógica: apenas a assinatura do componente.

### 2. Silenciar os avisos do React Router
Ativar as flags futuras no `BrowserRouter` em `src/App.tsx`:

```text
future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
```

Isso remove os dois avisos e antecipa o comportamento da v7 sem alterar rotas.

### 3. Validar a tela de Agentes
Abrir `/x-julia/agentes` no preview automatizado, confirmar que a lista carrega sem erro de import dinâmico e que o console fica sem avisos após os ajustes.

## Detalhes técnicos

- `forwardRef` mantém o `displayName` para o React DevTools continuar identificando os componentes.
- As flags `v7_startTransition` e `v7_relativeSplatPath` já são suportadas pela versão do React Router usada no projeto (6.x), portanto não exigem upgrade de pacote.
- Nada de backend, banco ou edge function é alterado neste plano.
