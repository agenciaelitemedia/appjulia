import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Minimize2, Maximize2, Keyboard, X, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SipStatus } from '../hooks/useSipPhone';

interface SoftphoneWidgetProps {
  status: SipStatus;
  duration: number;
  isMuted: boolean;
  isHeld: boolean;
  callerInfo: string;
  onAnswer: () => void;
  onHangup: () => void;
  onToggleMute: () => void;
  onToggleHold: () => void;
  onSendDTMF: (digit: string) => void;
  centered?: boolean;
  onCallFinished?: () => void;
  isDialing?: boolean;
  dialError?: string | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onCancel?: () => void;
}

const statusConfig: Record<SipStatus, { label: string; color: string; dotColor: string }> = {
  idle: { label: 'Offline', color: 'bg-muted text-muted-foreground', dotColor: 'bg-gray-400' },
  registering: { label: 'Conectando...', color: 'bg-yellow-500/10 text-yellow-600', dotColor: 'bg-yellow-500 animate-pulse' },
  registered: { label: 'Disponível', color: 'bg-green-500/10 text-green-600', dotColor: 'bg-green-500' },
  calling: { label: 'Chamando...', color: 'bg-blue-500/10 text-blue-600', dotColor: 'bg-blue-500 animate-pulse' },
  ringing: { label: 'Tocando', color: 'bg-orange-500/10 text-orange-600', dotColor: 'bg-orange-500 animate-pulse' },
  'in-call': { label: 'Em chamada', color: 'bg-green-500/10 text-green-600', dotColor: 'bg-green-500' },
  error: { label: 'Erro', color: 'bg-destructive/10 text-destructive', dotColor: 'bg-destructive' },
};

const dtmfKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export const SoftphoneWidget = React.forwardRef<HTMLDivElement, SoftphoneWidgetProps>(function SoftphoneWidget({
  status,
  duration,
  isMuted,
  isHeld,
  callerInfo,
  onAnswer,
  onHangup,
  onToggleMute,
  onToggleHold,
  onSendDTMF,
  centered = false,
  onCallFinished,
  isDialing = false,
  dialError = null,
  onRetry,
  onDismissError,
  onCancel,
}, ref) {
  const [minimized, setMinimized] = useState(false);
  const [showDTMF, setShowDTMF] = useState(false);
  const wasInCall = useRef(false);
  const graceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg = statusConfig[status];
  const isActive = ['calling', 'ringing', 'in-call'].includes(status);
  const showWidget = isDialing || !!dialError || isActive || status === 'registered' || status === 'registering';

  useEffect(() => {
    if (status === 'in-call' || status === 'calling' || status === 'ringing') {
      wasInCall.current = true;
      if (graceTimeout.current) {
        clearTimeout(graceTimeout.current);
        graceTimeout.current = null;
      }
    } else if (wasInCall.current && (status === 'registered' || status === 'idle')) {
      wasInCall.current = false;
      if (graceTimeout.current) clearTimeout(graceTimeout.current);
      graceTimeout.current = setTimeout(() => {
        graceTimeout.current = null;
        onCallFinished?.();
      }, 15000);
    }
  }, [status, onCallFinished]);

  useEffect(() => {
    return () => {
      if (graceTimeout.current) clearTimeout(graceTimeout.current);
    };
  }, []);

  const handleManualClose = useCallback(() => {
    if (graceTimeout.current) {
      clearTimeout(graceTimeout.current);
      graceTimeout.current = null;
    }
    onCallFinished?.();
  }, [onCallFinished]);

  // Don't render if nothing to show
  if (!showWidget && !centered) return null;
  if (status === 'idle' && !isDialing && !dialError && centered) return null;

  // --- Dialing state (API call in progress) ---
  const renderDialingState = () => (
    <div className="text-center space-y-4 py-4">
      <div className="relative mx-auto w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
          <Phone className="h-7 w-7 text-primary animate-pulse" />
        </div>
      </div>
      <div>
        <p className="text-xl font-semibold">{callerInfo || 'Conectando...'}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Conectando chamada...</p>
        </div>
      </div>
    </div>
  );

  // --- Error state ---
  const renderErrorState = () => (
    <div className="text-center space-y-4 py-4">
      <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <div>
        <p className="text-lg font-semibold">{callerInfo || 'Erro na chamada'}</p>
        <p className="text-sm text-destructive mt-1 px-2">{dialError}</p>
      </div>
      <div className="flex items-center justify-center gap-2">
        {onRetry && (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        )}
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={onDismissError || handleManualClose}>
          <X className="h-3.5 w-3.5" />
          Fechar
        </Button>
      </div>
    </div>
  );

  // --- Calling state (SIP calling) ---
  const renderCallingState = () => (
    <div className="text-center space-y-4 py-4">
      <div className="relative mx-auto w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/10">
          <Phone className="h-7 w-7 text-blue-600" />
        </div>
      </div>
      <div>
        <p className="text-xl font-semibold">{callerInfo}</p>
        <p className="text-sm text-blue-600 font-medium mt-1">Chamando...</p>
      </div>
      <Button
        size="icon"
        className="h-12 w-12 rounded-full bg-destructive hover:bg-destructive/90 mx-auto"
        onClick={onHangup}
      >
        <PhoneOff className="h-5 w-5 text-white" />
      </Button>
    </div>
  );

  // --- Ringing state ---
  const renderRingingState = () => (
    <div className="text-center space-y-4 py-4">
      <div className="relative mx-auto w-16 h-16">
        <div className="absolute inset-0 rounded-full bg-orange-500/20 animate-ping" style={{ animationDuration: '0.8s' }} />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-orange-500/10">
          <Phone className="h-7 w-7 text-orange-600 animate-bounce" />
        </div>
      </div>
      <div>
        <p className="text-xl font-semibold">{callerInfo}</p>
        <p className="text-sm text-orange-600 font-medium mt-1">Chamada recebida</p>
      </div>
      <div className="flex items-center justify-center gap-4">
        <Button
          size="icon"
          className="h-12 w-12 rounded-full bg-green-600 hover:bg-green-700"
          onClick={onAnswer}
        >
          <Phone className="h-5 w-5 text-white" />
        </Button>
        <Button
          size="icon"
          className="h-12 w-12 rounded-full bg-destructive hover:bg-destructive/90"
          onClick={onHangup}
        >
          <PhoneOff className="h-5 w-5 text-white" />
        </Button>
      </div>
    </div>
  );

  // --- In-call state ---
  const renderInCallState = () => (
    <div className="text-center space-y-3 py-2">
      <div>
        <p className="text-xl font-semibold">{callerInfo}</p>
        <p className="text-3xl font-mono text-primary mt-1 tabular-nums">{formatDuration(duration)}</p>
      </div>

      {showDTMF && (
        <div className="grid grid-cols-3 gap-1">
          {dtmfKeys.map((key) => (
            <Button key={key} variant="outline" size="sm" className="h-9 text-lg font-mono" onClick={() => onSendDTMF(key)}>
              {key}
            </Button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-3">
        <Button size="icon" variant={isMuted ? 'destructive' : 'outline'} className="h-10 w-10 rounded-full" onClick={onToggleMute}>
          {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant={isHeld ? 'secondary' : 'outline'} className="h-10 w-10 rounded-full" onClick={onToggleHold}>
          {isHeld ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant={showDTMF ? 'secondary' : 'outline'} className="h-10 w-10 rounded-full" onClick={() => setShowDTMF(!showDTMF)}>
          <Keyboard className="h-4 w-4" />
        </Button>
        <Button size="icon" className="h-12 w-12 rounded-full bg-destructive hover:bg-destructive/90" onClick={onHangup}>
          <PhoneOff className="h-5 w-5 text-white" />
        </Button>
      </div>
    </div>
  );

  // Determine which body to render
  const renderBody = () => {
    if (dialError) return renderErrorState();
    if (isDialing) return renderDialingState();
    if (status === 'calling') return renderCallingState();
    if (status === 'ringing') return renderRingingState();
    if (status === 'in-call') return renderInCallState();
    if (status === 'registered') return (
      <p className="text-center text-sm text-muted-foreground py-4">Softphone pronto</p>
    );
    return null;
  };

  // Header badge config
  const headerCfg = dialError
    ? { label: 'Erro na chamada', color: 'bg-destructive/10 text-destructive', dotColor: 'bg-destructive' }
    : isDialing
    ? { label: 'Conectando...', color: 'bg-blue-500/10 text-blue-600', dotColor: 'bg-blue-500 animate-pulse' }
    : cfg;

  // Centered mode: fullscreen overlay
  if (centered) {
    return (
      <div
        ref={ref}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <div className="relative w-[340px] rounded-2xl border bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', headerCfg.dotColor)} />
              <Badge variant="secondary" className={cn('text-xs font-medium', headerCfg.color)}>{headerCfg.label}</Badge>
            </div>
            {!isActive && !isDialing && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={dialError ? (onDismissError || handleManualClose) : handleManualClose}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {/* Body */}
          <div className="p-4">
            {renderBody()}
          </div>
        </div>
      </div>
    );
  }

  // Corner mode
  if (minimized) {
    return (
      <div ref={ref} className="fixed bottom-4 right-4 z-50">
        <Button size="sm" variant="outline" className={cn('gap-2 shadow-lg', headerCfg.color)} onClick={() => setMinimized(false)}>
          <span className={cn('h-2 w-2 rounded-full', headerCfg.dotColor)} />
          {headerCfg.label}
          {status === 'in-call' && <span className="font-mono text-xs">{formatDuration(duration)}</span>}
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div ref={ref} className="fixed bottom-4 right-4 z-50 w-80 rounded-2xl border bg-card shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', headerCfg.dotColor)} />
          <Badge variant="secondary" className={cn('text-xs font-medium', headerCfg.color)}>{headerCfg.label}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMinimized(true)}>
          <Minimize2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="p-4">
        {renderBody()}
      </div>
    </div>
  );
});
