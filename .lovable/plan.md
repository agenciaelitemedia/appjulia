

# Desabilitar Copiloto em produção (`acesso.atendejulia.com.br`)

## Plano

### 1. Criar helper de ambiente (`src/lib/environment.ts`)
- Função `isCopilotEnabled()` que retorna `false` quando `window.location.hostname === 'acesso.atendejulia.com.br'`

### 2. Guardar o widget (`src/components/copilot/CopilotWidget.tsx`)
- Importar `isCopilotEnabled` e retornar `null` no início se `false`

### 3. Esconder módulo admin do Copiloto (`src/components/layout/Sidebar.tsx`)
- Condicionar `useEnsureCopilotModule()` a `isCopilotEnabled()`

### 4. Proteger página admin (`src/pages/admin/copiloto/CopilotAdminPage.tsx`)
- Mostrar mensagem "Indisponível neste ambiente" se `!isCopilotEnabled()`

### Resultado
- Em `acesso.atendejulia.com.br`: widget não aparece, módulo não é criado no menu, página admin bloqueada
- Em qualquer outro domínio (preview, localhost): tudo funciona normalmente

