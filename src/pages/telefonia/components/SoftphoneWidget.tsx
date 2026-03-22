import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Minimize2, Maximize2, Keyboard, X } from 'lucide-react';
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
}

const statusConfig: Record<SipStatus, { label: string; color: string; dotColor: string }> = {
  idle: { label: 'Offline', color: 'bg-muted text-muted-foreground', dotColor: 'bg-gray-400' },
  registering: { label: 'Conectando...', color: 'bg-yellow-500/10 text-yellow-600', dotColor: 'bg-yellow-500 animate-pulse' },
  registered: { label: 'Disponível', color: 'bg-green-500/10 text-green-600', dotColor: 'bg-green-500' },
  calling: { label: 'Discando...', color: 'bg-blue-500/10 text-blue-600', dotColor: 'bg-blue-500 animate-pulse' },
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

export function SoftphoneWidget({
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
}: SoftphoneWidgetProps) {
  const [minimized, setMinimized] = useState(false);
  const [showDTMF, setShowDTMF] = useState(false);
  const wasInCall = useRef(false);
  const graceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cfg = statusConfig[status];
  const isActive = ['calling', 'ringing', 'in-call'].includes(status);

  // Track call end with 15s grace period for PBX callback
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

  if (status === 'idle' && !centered) return null;
  if (status === 'idle' && centered) return null;

  // Centered mode: fullscreen overlay with click-blocking backdrop
  if (centered) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Backdrop - blocks all interaction below */}
        <div className="absolute inset-0 bg-black/50" />

        {/* Card */}
        <div className="relative w-80 rounded-xl border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dotColor)} />
              <Badge variant="secondary" className={cn('text-xs', cfg.color)}>{cfg.label}</Badge>
            </div>
            {!isActive && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleManualClose}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Body */}
          <div className="p-4 space-y-3">
            {callerInfo && (
              <div className="text-center">
                <p className="text-lg font-mono font-bold tracking-wider">{callerInfo}</p>
                {status === 'in-call' && (
                  <p className="text-2xl font-mono text-primary mt-1">{formatDuration(duration)}</p>
                )}
              </div>
            )}

            {!isActive && status === 'registered' && (
              <p className="text-center text-sm text-muted-foreground">Softphone pronto</p>
            )}

            {/* DTMF Pad */}
            {showDTMF && status === 'in-call' && (
              <div className="grid grid-cols-3 gap-1">
                {dtmfKeys.map((key) => (
                  <Button
                    key={key}
                    variant="outline"
                    size="sm"
                    className="h-9 text-lg font-mono"
                    onClick={() => onSendDTMF(key)}
                  >
                    {key}
                  </Button>
                ))}
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
              {status === 'ringing' && (
                <Button size="icon" className="h-10 w-10 rounded-full bg-green-600 hover:bg-green-700" onClick={onAnswer}>
                  <Phone className="h-4 w-4 text-white" />
                </Button>
              )}

              {status === 'in-call' && (
                <>
                  <Button
                    size="icon"
                    variant={isMuted ? 'destructive' : 'outline'}
                    className="h-9 w-9 rounded-full"
                    onClick={onToggleMute}
                  >
                    {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant={isHeld ? 'secondary' : 'outline'}
                    className="h-9 w-9 rounded-full"
                    onClick={onToggleHold}
                  >
                    {isHeld ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="icon"
                    variant={showDTMF ? 'secondary' : 'outline'}
                    className="h-9 w-9 rounded-full"
                    onClick={() => setShowDTMF(!showDTMF)}
                  >
                    <Keyboard className="h-4 w-4" />
                  </Button>
                </>
              )}

              {isActive && (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-destructive hover:bg-destructive/90"
                  onClick={onHangup}
                >
                  <PhoneOff className="h-4 w-4 text-white" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default corner mode
  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          size="sm"
          variant="outline"
          className={cn('gap-2 shadow-lg', cfg.color)}
          onClick={() => setMinimized(false)}
        >
          <span className={cn('h-2 w-2 rounded-full', cfg.dotColor)} />
          {cfg.label}
          {status === 'in-call' && <span className="font-mono text-xs">{formatDuration(duration)}</span>}
          <Maximize2 className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border bg-card shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dotColor)} />
          <Badge variant="secondary" className={cn('text-xs', cfg.color)}>{cfg.label}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setMinimized(true)}>
          <Minimize2 className="h-3 w-3" />
        </Button>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {callerInfo && (
          <div className="text-center">
            <p className="text-lg font-mono font-bold tracking-wider">{callerInfo}</p>
            {status === 'in-call' && (
              <p className="text-2xl font-mono text-primary mt-1">{formatDuration(duration)}</p>
            )}
          </div>
        )}

        {!isActive && status === 'registered' && (
          <p className="text-center text-sm text-muted-foreground">Softphone pronto</p>
        )}

        {/* DTMF Pad */}
        {showDTMF && status === 'in-call' && (
          <div className="grid grid-cols-3 gap-1">
            {dtmfKeys.map((key) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="h-9 text-lg font-mono"
                onClick={() => onSendDTMF(key)}
              >
                {key}
              </Button>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          {status === 'ringing' && (
            <Button size="icon" className="h-10 w-10 rounded-full bg-green-600 hover:bg-green-700" onClick={onAnswer}>
              <Phone className="h-4 w-4 text-white" />
            </Button>
          )}

          {status === 'in-call' && (
            <>
              <Button
                size="icon"
                variant={isMuted ? 'destructive' : 'outline'}
                className="h-9 w-9 rounded-full"
                onClick={onToggleMute}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant={isHeld ? 'secondary' : 'outline'}
                className="h-9 w-9 rounded-full"
                onClick={onToggleHold}
              >
                {isHeld ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant={showDTMF ? 'secondary' : 'outline'}
                className="h-9 w-9 rounded-full"
                onClick={() => setShowDTMF(!showDTMF)}
              >
                <Keyboard className="h-4 w-4" />
              </Button>
            </>
          )}

          {isActive && (
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-destructive hover:bg-destructive/90"
              onClick={onHangup}
            >
              <PhoneOff className="h-4 w-4 text-white" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
