import React, { useState } from 'react';
import { cn } from '@/lib/utils';

interface ExpandableMessageTextProps {
  text: string;
  formatter: (text: string) => React.ReactNode;
  className?: string;
}

const CHAR_LIMIT = 350;
const LINE_LIMIT = 6;

export function ExpandableMessageText({ text, formatter, className }: ExpandableMessageTextProps) {
  const [expanded, setExpanded] = useState(false);

  const lineCount = (text.match(/\n/g) || []).length + 1;
  const needsTruncation = text.length > CHAR_LIMIT || lineCount > LINE_LIMIT;

  if (!needsTruncation) {
    return (
      <p className={cn('text-sm whitespace-pre-wrap break-words', className)}>
        {formatter(text)}
      </p>
    );
  }

  const truncated = expanded
    ? text
    : text.split('\n').slice(0, LINE_LIMIT).join('\n').slice(0, CHAR_LIMIT).trimEnd() + '…';

  return (
    <div className={cn('text-sm', className)}>
      <p className="whitespace-pre-wrap break-words">{formatter(truncated)}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded((v) => !v);
        }}
        className="mt-1 text-xs font-medium underline-offset-2 hover:underline opacity-80"
      >
        {expanded ? 'Ler menos' : 'Ler mais'}
      </button>
    </div>
  );
}
