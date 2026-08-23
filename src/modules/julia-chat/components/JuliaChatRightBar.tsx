import { Sheet, SheetContent, SheetTitle, SheetDescription } from '../extend/ui';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { ChatRightBar, ErrorBoundary, useWhatsAppData } from '../extend/chat';
import { JuliaChatDetailsPanel } from './JuliaChatDetailsPanel';
import type { JuliaChatRowData } from '../api/types';

/**
 * Coluna 3 do JulIA Chat: a right-bar do chat principal (abas Contato / CRM / Lead)
 * quando existe conversa selecionada. Sem seleção, mantém o resumo do JulIA Chat.
 * Abaixo de `lg` a barra vira overlay, como no /chat.
 */
export function JuliaChatRightBar({ row, isBelowLg }: { row: JuliaChatRowData | null; isBelowLg: boolean }) {
  const { selectedContact, showDetailPanel, setShowDetailPanel } = useWhatsAppData();

  if (!selectedContact) {
    return <JuliaChatDetailsPanel row={row} />;
  }

  if (isBelowLg) {
    return (
      <Sheet open={showDetailPanel} onOpenChange={setShowDetailPanel}>
        <SheetContent side="right" className="w-full p-0 sm:w-[440px] sm:max-w-[440px] lg:hidden">
          <VisuallyHidden>
            <SheetTitle>Detalhes da conversa</SheetTitle>
            <SheetDescription>Informações do contato e card do CRM</SheetDescription>
          </VisuallyHidden>
          <ChatRightBar
            contact={selectedContact}
            onClose={() => setShowDetailPanel(false)}
            className="h-full border-l-0"
          />
        </SheetContent>
      </Sheet>
    );
  }

  if (!showDetailPanel) return null;

  return (
    <ErrorBoundary
      fallback={<div className="p-6 text-sm text-muted-foreground">Erro ao carregar o painel.</div>}
    >
      <ChatRightBar
        contact={selectedContact}
        onClose={() => setShowDetailPanel(false)}
        className="h-full w-full"
      />
    </ErrorBoundary>
  );
}
