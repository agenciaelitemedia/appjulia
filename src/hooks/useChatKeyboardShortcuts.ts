import { useEffect } from 'react';

interface ShortcutHandlers {
  onNext?: () => void;          // j
  onPrev?: () => void;          // k
  onResolve?: () => void;       // e
  onTransfer?: () => void;      // #
  onSearch?: () => void;        // /
  onSnooze?: () => void;        // z
  onClose?: () => void;         // Escape (deselect conversation)
  onHelp?: () => void;          // ?
  enabled?: boolean;
}

/**
 * Global keyboard shortcuts for the chat module.
 * Linear/Superhuman style: single-letter actions, no modifiers.
 * Disabled when focus is inside an input/textarea/contenteditable.
 */
export function useChatKeyboardShortcuts(handlers: ShortcutHandlers) {
  const enabled = handlers.enabled !== false;

  useEffect(() => {
    if (!enabled) return;

    const isTypingTarget = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const handler = (e: KeyboardEvent) => {
      // Allow Escape always
      if (e.key === 'Escape') {
        handlers.onClose?.();
        return;
      }

      // Skip when typing
      if (isTypingTarget(e.target)) return;

      // Skip when modifier keys (browser shortcuts)
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'j':
          e.preventDefault();
          handlers.onNext?.();
          break;
        case 'k':
          e.preventDefault();
          handlers.onPrev?.();
          break;
        case 'e':
          e.preventDefault();
          handlers.onResolve?.();
          break;
        case '#':
          e.preventDefault();
          handlers.onTransfer?.();
          break;
        case '/':
          e.preventDefault();
          handlers.onSearch?.();
          break;
        case 'z':
          e.preventDefault();
          handlers.onSnooze?.();
          break;
        case '?':
          e.preventDefault();
          handlers.onHelp?.();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, handlers]);
}
