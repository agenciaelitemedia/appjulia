## Ajuste no sidebar: padrão recolhido e ícone `PanelLeftClose`

### Objetivo
- Fazer o painel lateral iniciar **recolhido** por padrão.
- Manter o ícone `PanelLeftClose` como referência visual do controle de recolhimento/expansão.
- O painel só expande quando o usuário clicar no ícone.

### Alterações previstas
1. **`src/components/layout/MainLayout.tsx`**
   - Inverter o estado inicial de `sidebarCollapsed` de `false` para `true`.

2. **`src/components/layout/Header.tsx`**
   - Inverter a lógica de ícones para que o ícone reflita o estado atual do painel:
     - Quando recolhido (`isCollapsed === true`): mostra `PanelLeftClose`.
     - Quando expandido (`isCollapsed === false`): mostra `PanelLeft`.
   - Ajustar o tooltip de acordo ("Expandir menu" / "Recolher menu").

3. **Verificação**
   - Confirmar que o layout usa `lg:ml-16`/`lg:ml-64` e que o `Sidebar` reage ao `isCollapsed`.
   - Validar que o botão de toggle no header permanece visível e funcional no desktop.

### Escopo
- Apenas frontend: `MainLayout.tsx` e `Header.tsx`.
- Sem alterações de backend, banco ou permissões.
