# Criar projeto "Atende Julia - v3-supabase"

## Objetivo
Criar um novo projeto Lovable em branco com o nome exato "Atende Julia - v3-supabase", sem ativar backend por enquanto.

## Contexto
A criação de um novo projeto Lovable não pode ser feita pelo chat do agente; ela é iniciada no dashboard da Lovable. Por isso, o plano abaixo divide a ação entre o que o usuário faz no dashboard e o que configuramos depois no novo projeto.

## Passos

1. **Criar o projeto no dashboard da Lovable**
   - Acessar o dashboard da Lovable e clicar em "New project" / "Novo projeto".
   - Escolher a opção de projeto em branco (blank/empty template).
   - Definir o nome: `Atende Julia - v3-supabase`.
   - Confirmar a criação.

2. **(Opcional) Conectar GitHub**
   - No novo projeto, abrir o menu Plus (+) → GitHub.
   - Conectar a conta GitHub e transferir o código, caso queira versionamento externo.

3. **Configurar identidade básica no novo projeto**
   - Atualizar título e descrição no `__root.tsx` para refletir "Atende Julia - v3-supabase".
   - Substituir o placeholder da página inicial (`src/routes/index.tsx`) por uma tela em branco ou com o nome do app.
   - Ajustar favicon/ícone se desejar.

4. **Não ativar Lovable Cloud neste momento**
   - Deixar o backend desligado, conforme solicitado.
   - Quando quiser adicionar banco/auth/storage, ativamos o Lovable Cloud em um próximo passo.

## Próxima ação esperada
Após criar o projeto no dashboard, me chamar no chat do novo projeto para que eu configure a identidade e a página inicial.
