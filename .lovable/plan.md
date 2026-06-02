## Objetivo
Criar uma referência visual no painel de Templates WABA (`/chat/configuracoes` → aba Templates WABA) que liste todos os 6 tipos de HEADER suportados pela Meta, com descrição e exemplo visual de cada um.

## Onde
- `src/pages/chat/waba-templates/WabaTemplatesPanel.tsx` — adicionar um botão "Tipos de cabeçalho" no header do painel (ao lado de "Sincronizar" / "Novo template") que abre um Dialog.
- Novo arquivo: `src/pages/chat/waba-templates/HeaderTypesReferenceDialog.tsx` — conteúdo da referência.

## Conteúdo do Dialog
Grid responsivo (2 colunas em desktop, 1 em mobile) com 6 cards, um por tipo:

1. **NONE** — Sem cabeçalho. O template começa direto pelo BODY. Útil para mensagens curtas/transacionais. Exemplo: confirmação de agendamento.
2. **TEXT** — Cabeçalho de texto (até 60 caracteres). Suporta 1 variável `{{1}}`. Exemplo: "Olá, {{1}}! 👋".
3. **IMAGE** — Imagem no topo (JPG/PNG, até 5 MB). Exemplo: banner de promoção.
4. **VIDEO** — Vídeo no topo (MP4, até 16 MB). Exemplo: vídeo curto de boas-vindas.
5. **DOCUMENT** — Documento PDF (até 100 MB). Exemplo: envio de contrato ou boleto.
6. **LOCATION** — Localização (latitude/longitude). Exemplo: endereço do escritório para audiência.

Cada card terá:
- Badge com o nome do tipo (NONE, TEXT, etc.)
- Título amigável + descrição em PT-BR
- Limites/formatos aceitos
- Mini preview WhatsApp reaproveitando o componente existente `WhatsappPreview` (passando `components` mockados, com BODY genérico fixo).

## Detalhes técnicos
- Reuso de `WhatsappPreview` de `./WhatsappPreview.tsx` (já renderiza ícones para IMAGE/VIDEO/DOCUMENT/LOCATION e texto para TEXT).
- Dialog padrão shadcn (`@/components/ui/dialog`) com `max-w-4xl` e `max-h-[85vh] overflow-y-auto`.
- Ícone do botão: `HelpCircle` do lucide-react, variant `outline`, label "Tipos de cabeçalho".
- Sem alteração de lógica de negócio; somente UI informativa.

## Validação
- Abrir `/chat/configuracoes` → aba Templates WABA → clicar no novo botão → verificar que os 6 cards aparecem com seus previews renderizados corretamente.
