import { useMemo } from 'react';

interface DiffViewerProps {
  oldText: string;
  newText: string;
  oldLabel?: string;
  newLabel?: string;
}

export function DiffViewer({ oldText, newText, oldLabel = 'Versão anterior', newLabel = 'Versão atual' }: DiffViewerProps) {
  const diff = useMemo(() => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLen = Math.max(oldLines.length, newLines.length);
    const result: { oldLine: string | null; newLine: string | null; type: 'same' | 'removed' | 'added' | 'changed' }[] = [];

    // Simple LCS-based diff
    const lcs = Array.from({ length: oldLines.length + 1 }, () => Array(newLines.length + 1).fill(0));
    for (let i = 1; i <= oldLines.length; i++) {
      for (let j = 1; j <= newLines.length; j++) {
        lcs[i][j] = oldLines[i - 1] === newLines[j - 1]
          ? lcs[i - 1][j - 1] + 1
          : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
      }
    }

    const lines: { oldLine: string | null; newLine: string | null; type: 'same' | 'removed' | 'added' }[] = [];
    let i = oldLines.length, j = newLines.length;
    const stack: typeof lines = [];
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
        stack.push({ oldLine: oldLines[i - 1], newLine: newLines[j - 1], type: 'same' });
        i--; j--;
      } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
        stack.push({ oldLine: null, newLine: newLines[j - 1], type: 'added' });
        j--;
      } else {
        stack.push({ oldLine: oldLines[i - 1], newLine: null, type: 'removed' });
        i--;
      }
    }
    stack.reverse();
    return stack;
  }, [oldText, newText]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-xs font-semibold text-muted-foreground px-2">{oldLabel}</div>
        <div className="text-xs font-semibold text-muted-foreground px-2">{newLabel}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 max-h-[500px] overflow-y-auto">
        {/* Old side */}
        <div className="rounded border bg-muted/30 overflow-x-auto">
          {diff.map((line, idx) => (
            <div
              key={idx}
              className={`px-2 py-0.5 text-xs font-mono whitespace-pre-wrap ${
                line.type === 'removed' ? 'bg-red-500/15 text-red-700 dark:text-red-400' :
                line.type === 'added' ? 'opacity-30' : ''
              }`}
            >
              {line.type === 'removed' && <span className="mr-1 text-red-500">−</span>}
              {line.oldLine ?? (line.type === 'added' ? '' : line.oldLine)}
              {line.type === 'added' && '\u00A0'}
            </div>
          ))}
        </div>
        {/* New side */}
        <div className="rounded border bg-muted/30 overflow-x-auto">
          {diff.map((line, idx) => (
            <div
              key={idx}
              className={`px-2 py-0.5 text-xs font-mono whitespace-pre-wrap ${
                line.type === 'added' ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                line.type === 'removed' ? 'opacity-30' : ''
              }`}
            >
              {line.type === 'added' && <span className="mr-1 text-green-500">+</span>}
              {line.newLine ?? (line.type === 'removed' ? '' : line.newLine)}
              {line.type === 'removed' && '\u00A0'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
