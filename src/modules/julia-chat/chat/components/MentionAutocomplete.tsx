import React, { useEffect, useMemo, useRef, useState } from 'react';

interface TeamMember {
  id: number | string;
  name: string;
}

interface MentionAutocompleteProps {
  text: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  team: TeamMember[];
  onPick: (member: TeamMember) => void;
}

/**
 * Inline mention popover for textareas.
 * Detects "@xxx" at the cursor and shows a list of matching team members.
 */
export function MentionAutocomplete({ text, textareaRef, team, onPick }: MentionAutocompleteProps) {
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const popRef = useRef<HTMLDivElement>(null);

  // Detect @mention at cursor
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) { setQuery(null); return; }
    const cursor = ta.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const m = before.match(/@([\p{L}\p{N}_]*)$/u);
    setQuery(m ? m[1] : null);
    setActive(0);
  }, [text, textareaRef]);

  const matches = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return team
      .filter((m) => m.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, team]);

  // Keyboard navigation handled by parent through events
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || matches.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
      else if (e.key === 'Tab' || e.key === 'Enter') {
        if (matches[active]) {
          e.preventDefault();
          onPick(matches[active]);
        }
      } else if (e.key === 'Escape') { setQuery(null); }
    };
    ta.addEventListener('keydown', handler);
    return () => ta.removeEventListener('keydown', handler);
  }, [matches, active, textareaRef, onPick]);

  if (query === null || matches.length === 0) return null;

  return (
    <div
      ref={popRef}
      className="absolute bottom-full left-0 mb-1 z-50 min-w-[220px] bg-popover border rounded-md shadow-lg overflow-hidden"
    >
      <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground bg-muted/50 border-b">
        Mencionar
      </div>
      <div className="max-h-56 overflow-y-auto">
        {matches.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPick(m)}
            onMouseEnter={() => setActive(i)}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${i === active ? 'bg-accent' : ''}`}
          >
            <span className="font-medium">@{m.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
