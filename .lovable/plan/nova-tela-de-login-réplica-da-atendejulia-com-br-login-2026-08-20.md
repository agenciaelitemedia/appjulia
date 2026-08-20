# Nova tela de Login — réplica da atendejulia.com.br/login

Substituir a tela `/login` atual da Julia por uma cópia fiel do login publicado em atendejulia.com.br, usando a nova logomarca e o mascote enviados.

## O que a tela nova tem (capturado do site real)

Layout em duas colunas (55/45) em fundo escuro roxo, com:

- **Fundo**: dois "auroras" desfocados (magenta e violeta, blur 90px, opacidade 35%) + grade de linhas 64x64 sutil.
- **Coluna esquerda**: logomarca ATENDE JULIA no topo; título "Seu atendimento continua. **Você só precisa entrar.**" (segunda frase em gradiente magenta→violeta); subtítulo "Acesse sua conta para acompanhar, organizar e conduzir seus atendimentos com a Julia."; mascote grande com animação de flutuar; três cartões de vidro flutuantes com bolinha pulsante:
  - Novo contato recebido — Mariana A. • WhatsApp • agora (magenta)
  - Lead qualificado — Trabalhista • pronto para a equipe (violeta)
  - Contrato em andamento — Proposta enviada • aguardando assinatura (verde)
- **Coluna direita — card de vidro** com brilho magenta: "Bem-vindo de volta" / "Entre para acessar sua operação com a Julia."; campos E-MAIL (ícone envelope) e SENHA (ícone cadeado + olho mostrar/ocultar), ambos arredondados; linha com "Lembrar de mim" (checkbox) e "Esqueci minha senha"; botão pill em gradiente "Entrar na Atende Julia →"; separador "OU"; "Ainda não conhece a Julia?" + botão de vidro "Fale com nosso time" (WhatsApp); rodapé "Ambiente seguro • Dados protegidos • Acesso exclusivo".
- **Mobile**: uma coluna, mascote pequeno ao lado do título, card do formulário abaixo.
- **Tipografia**: Sora (títulos) + Plus Jakarta Sans (texto).

## Comportamento

A lógica de autenticação atual é mantida sem alterações: mesmo `login()` do AuthContext, mesmos toasts, checagem de versão ao abrir a tela, `markJustLoggedIn()` e redirecionamento para `/dashboard`.

- "Lembrar de mim": apenas visual por enquanto (marcado por padrão), sem mudar a sessão.
- "Esqueci minha senha": aponta para o WhatsApp de suporte (não existe fluxo de recuperação hoje).
- "Fale com nosso time": WhatsApp `5534988860163`, como no site.

## Assets

- Logomarca nova (imagem enviada) publicada como asset CDN e usada no login. Fica disponível para reuso; não troco a logo do resto do sistema nesta etapa.
- Mascote: recorto a pose "acenando" da folha de poses enviada (fundo transparente) e publico como asset para o herói do login. Os cards de referência de estilo (01–05) servem só como guia visual.

## Detalhes técnicos

- Reescrever `src/pages/Login.tsx` com o markup/classes equivalentes (Tailwind v3 + tokens semânticos), sem mexer em rotas.
- Adicionar tokens de tema apenas no escopo da tela (`--aj-*` em HSL no `index.css` + classes utilitárias `aurora`, `grid-lines`, `glass`, `glow-ring`, `text-gradient`, `bg-brand`, `animate-float`, `animate-pulse-soft`). A tela força tema escuro localmente, sem alterar o tema global do app nem os tokens já usados por outros módulos.
- Fontes Sora e Plus Jakarta Sans carregadas via `index.html` e registradas no `tailwind.config.ts` como famílias extras (fonte padrão do app permanece).
- Ícones do lucide-react já disponíveis (Mail, Lock, Eye/EyeOff, Check, ArrowRight, ShieldCheck).
- Nenhuma mudança em backend, permissões ou banco.
