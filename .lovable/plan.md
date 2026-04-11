

## Fix: Contract Details Sidebar Truncated Content in CRM Chat

### Problem
The contract details panel inside the chat has content being truncated — address and case summary sections are not fully visible. Two causes:
1. The panel width (`w-[440px]`) is too narrow for the 2-column grid layout, causing text truncation
2. The `ScrollArea` in `ContractInfoContent` has `max-h-[70vh]` which clips content when used inside the sidebar (it was designed for a dialog, not an embedded panel)

### Changes

**`src/pages/crm/components/WhatsAppMessagesDialog.tsx`**
- Increase contract panel width from `w-[440px]` to `w-[480px]`
- Increase total expanded sheet width from `1100px` to `1140px` to accommodate
- Add `min-w-0` to prevent flex shrink issues

**`src/pages/crm/components/ContractInfoContent.tsx`**
- Remove the `max-h-[70vh]` constraint from the `ScrollArea` — when used inside the sidebar, the parent `div.flex-1.overflow-auto` already handles scrolling
- Change `ScrollArea` to use `className="h-full"` instead, so it fills available space and scrolls properly
- Ensure all sections (address, case summary, agent info) render without truncation

