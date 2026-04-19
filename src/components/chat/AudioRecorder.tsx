import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Trash2, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { webmBlobToOggOpus } from '@/lib/audio/webmToOgg';

interface AudioRecorderProps {
  onSend: (audioBlob: Blob) => Promise<void>;
  onCancel: () => void;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Prefer ogg/opus (WhatsApp-compatible). Fall back to webm/opus.
      const preferred = [
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/webm;codecs=opus',
        'audio/webm',
      ];
      const chosenMime = preferred.find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const mediaRecorder = chosenMime
        ? new MediaRecorder(stream, { mimeType: chosenMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const recordedMime = (mediaRecorder.mimeType || chosenMime || '').toLowerCase();
        const rawBlob = new Blob(chunksRef.current, { type: recordedMime || 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());

        // If MediaRecorder produced WebM (Chrome/Edge default), remux container to true OGG/Opus
        // so Meta WABA accepts it (Meta inspects magic bytes — renaming MIME alone fails).
        // Safari's audio/mp4 path is left untouched (Meta natively accepts audio/mp4).
        if (recordedMime.includes('webm')) {
          try {
            const ogg = await webmBlobToOggOpus(rawBlob);
            setAudioBlob(ogg);
            return;
          } catch (err) {
            console.error('[AudioRecorder] WebM→OGG remux failed, sending raw blob:', err);
          }
        }
        setAudioBlob(rawBlob);
      };

      mediaRecorder.start(250);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
  }, []);

  const handleCancel = useCallback(() => {
    stopRecording();
    streamRef.current?.getTracks().forEach(t => t.stop());
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  }, [stopRecording, onCancel]);

  const handleSend = useCallback(async () => {
    if (!audioBlob) return;
    setIsSending(true);
    try {
      await onSend(audioBlob);
    } finally {
      setIsSending(false);
      setAudioBlob(null);
      setDuration(0);
    }
  }, [audioBlob, onSend]);

  // Auto-start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  // intentionally runs once on mount — no dependencies needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5 border-t animate-in slide-in-from-bottom-2">
      {/* Cancel */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-destructive hover:bg-destructive/10"
        onClick={handleCancel}
        disabled={isSending}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      {/* Recording indicator / Waveform */}
      <div className="flex-1 flex items-center gap-3">
        {isRecording && (
          <div className="h-3 w-3 rounded-full bg-destructive animate-pulse" />
        )}
        
        {/* Simple waveform visualization */}
        <div className="flex items-center gap-0.5 flex-1">
          {isRecording && Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-destructive/60 rounded-full"
              style={{
                height: `${Math.random() * 16 + 4}px`,
                animationDelay: `${i * 50}ms`,
              }}
            />
          ))}
          {!isRecording && audioBlob && (
            <span className="text-sm text-muted-foreground">Áudio gravado</span>
          )}
        </div>

        {/* Timer */}
        <span className={cn(
          'text-sm font-mono min-w-[40px] text-right',
          isRecording ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {formatDuration(duration)}
        </span>
      </div>

      {/* Stop / Send */}
      {isRecording ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-destructive hover:bg-destructive/10"
          onClick={stopRecording}
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      ) : audioBlob ? (
        <Button
          size="icon"
          className="h-9 w-9"
          onClick={handleSend}
          disabled={isSending}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      ) : null}
    </div>
  );
}
