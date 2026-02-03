import { useDebug, ConsoleLog } from '@/contexts/DebugContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatTime(date: Date): string {
  const time = date.toLocaleTimeString('pt-BR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
  });
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${time}.${ms}`;
}

function getLevelStyles(level: ConsoleLog['level']) {
  switch (level) {
    case 'error':
      return {
        bg: 'bg-destructive/10',
        badge: 'bg-destructive/20 text-destructive border-destructive/30',
        text: 'text-destructive'
      };
    case 'warn':
      return {
        bg: 'bg-yellow-500/10',
        badge: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
        text: 'text-yellow-600'
      };
    case 'info':
      return {
        bg: '',
        badge: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
        text: 'text-blue-500'
      };
    case 'debug':
      return {
        bg: '',
        badge: 'bg-purple-500/20 text-purple-500 border-purple-500/30',
        text: 'text-purple-500'
      };
    default:
      return {
        bg: '',
        badge: 'bg-muted text-muted-foreground border-border',
        text: ''
      };
  }
}

function formatArg(arg: any): string {
  if (arg === null) return 'null';
  if (arg === undefined) return 'undefined';
  if (typeof arg === 'string') return arg;
  if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg, null, 2);
  } catch {
    return String(arg);
  }
}

function ConsoleRow({ log, index }: { log: ConsoleLog; index: number }) {
  const styles = getLevelStyles(log.level);
  
  const formattedArgs = log.args.map(formatArg).join(' ');

  return (
    <div 
      className={cn(
        "flex items-start gap-2 px-2 py-1.5 border-b border-border/50 last:border-0 text-xs",
        styles.bg
      )}
    >
      <span className="text-muted-foreground w-6 shrink-0 pt-0.5">{index + 1}</span>
      <Badge 
        variant="outline" 
        className={cn("text-[10px] px-1.5 py-0 shrink-0 uppercase", styles.badge)}
      >
        {log.level}
      </Badge>
      <pre className={cn(
        "font-mono text-[11px] flex-1 whitespace-pre-wrap break-all",
        styles.text
      )}>
        {formattedArgs}
      </pre>
      <span className="text-muted-foreground shrink-0 pt-0.5">
        {formatTime(log.timestamp)}
      </span>
    </div>
  );
}

export function ConsolePanel() {
  const { consoleLogs, clearLogs } = useDebug();

  const errorCount = consoleLogs.filter(l => l.level === 'error').length;
  const warnCount = consoleLogs.filter(l => l.level === 'warn').length;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-muted-foreground">
            Total: <span className="text-foreground font-medium">{consoleLogs.length}</span> logs
          </span>
          {errorCount > 0 && (
            <span className="text-destructive">
              Errors: <span className="font-medium">{errorCount}</span>
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-yellow-600">
              Warnings: <span className="font-medium">{warnCount}</span>
            </span>
          )}
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-6 text-xs"
          onClick={() => clearLogs('console')}
        >
          <Trash2 className="h-3 w-3 mr-1" />
          Clear
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {consoleLogs.length === 0 ? (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Nenhum log registrado
          </div>
        ) : (
          consoleLogs.map((log, index) => (
            <ConsoleRow key={log.id} log={log} index={index} />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
