

## Plan: Add contract details icon + inline name editing to CRM chat header

### What will change

1. **Contract icon in chat header** (before the Bot status icon)
   - Add a `Scale` icon button to the left of the existing Bot icon in the `WhatsAppMessagesDialog` header
   - Use `useContractInfo` hook (already exists) to check if a contract exists, passing `whatsappNumber` and `codAgent`
   - If contract exists: clicking opens a secondary Sheet sidebar (to the right of the chat) showing the same contract details content currently in `ContractInfoDialog`
   - If no contract: icon appears disabled/muted, or shows a tooltip "Sem contrato"
   - Extract the contract details content from `ContractInfoDialog` into a reusable component (`ContractInfoContent`) so it can be rendered both in the existing Dialog and in the new Sheet sidebar

2. **Editable lead name in chat header**
   - Replace the static `leadName` display in the header with an inline editable field (same pattern as `CRMLeadCard`)
   - Show a `Pencil` icon on hover next to the name
   - Clicking enters edit mode with an input field + check/cancel buttons
   - Use `useUpdateCardName` mutation to save (needs the card ID — will need to look up or pass it)
   - Since `WhatsAppMessagesDialog` doesn't receive a `cardId`, we'll use `useCRMCardByWhatsapp` (or query by whatsappNumber) to find the card and get its ID for the update

### Files to modify

- **`src/pages/crm/components/WhatsAppMessagesDialog.tsx`**
  - Import `Scale`, `Pencil`, `Check`, `X` icons, `useContractInfo`, `useUpdateCardName`, `Sheet/SheetContent` for contract sidebar
  - Add contract sidebar state and editable name state to the component
  - Modify header section (lines ~1638-1679): add contract icon before Bot icon, replace static name with editable name
  - Add a nested Sheet for contract details sidebar

- **`src/pages/crm/components/ContractInfoContent.tsx`** (new file)
  - Extract the inner content (ScrollArea with contract details) from `ContractInfoDialog` into a standalone component
  - Reuse in both `ContractInfoDialog` and the new chat sidebar

- **`src/pages/crm/components/ContractInfoDialog.tsx`**
  - Refactor to use `ContractInfoContent` internally

### Technical details

- The contract sidebar will be a `Sheet` with `side="right"` rendered inside the chat component, appearing alongside the chat
- `useContractInfo` will be called with `enabled: true` (always fetch when chat opens) to know if contract data exists
- For the card ID needed by `useUpdateCardName`, we'll use `useCRMCardByWhatsapp` hook (already used elsewhere) to look up the card by whatsapp number
- The name edit will update both the local display and the external DB via the existing mutation

