import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Square, Trash2, Send, Loader2, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioRecorderProps {
  onSend: (audioBlob: Blob) => Promise<void>;
  onCancel: () => void;
}

export function AudioRecorder({ onSend, onCancel }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Keep the browser-native recording container here.
      // Provider-specific conversion (e.g. WebM -> OGG for the official API)
      // is handled later during send so UaZapi can still receive raw WebM/Opus.
      const preferred = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/ogg',
        'audio/mp4',
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
        setAudioBlob(rawBlob);
        const url = URL.createObjectURL(rawBlob);
        setPreviewUrl(url);
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
    if (audioElRef.current) { audioElRef.current.pause(); }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setIsPlaying(false);
    setPlaybackTime(0);
    setAudioBlob(null);
    setDuration(0);
    onCancel();
  }, [stopRecording, onCancel, previewUrl]);

  const handleSend = useCallback(async () => {
    if (!audioBlob) return;
    setIsSending(true);
    try {
      await onSend(audioBlob);
    } finally {
      setIsSending(false);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setIsPlaying(false);
      setPlaybackTime(0);
      setAudioBlob(null);
      setDuration(0);
    }
  }, [audioBlob, onSend, previewUrl]);

  const togglePlayback = useCallback(() => {
    const el = audioElRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }, []);

  // Auto-start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  // intentionally runs once on mount — no dependencies needed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-destructive/5 border-t animate-in slide-in-from-bottom-2">
      {previewUrl && (
        <audio
          ref={audioElRef}
          src={previewUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => { setIsPlaying(false); setPlaybackTime(0); }}
          onTimeUpdate={(e) => setPlaybackTime(Math.floor((e.target as HTMLAudioElement).currentTime))}
          className="hidden"
        />
      )}
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

      {/* Play preview (after recording stops) */}
      {!isRecording && audioBlob && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-primary hover:bg-primary/10"
          onClick={togglePlayback}
          disabled={isSending}
          aria-label={isPlaying ? 'Pausar prévia' : 'Ouvir prévia'}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
      )}

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
            <span className="text-sm text-muted-foreground">
              {isPlaying ? 'Reproduzindo prévia…' : 'Prévia pronta — ouça antes de enviar'}
            </span>
          )}
        </div>

        {/* Timer */}
        <span className={cn(
          'text-sm font-mono min-w-[40px] text-right',
          isRecording ? 'text-destructive' : 'text-muted-foreground'
        )}>
          {isPlaying || playbackTime > 0
            ? `${formatDuration(playbackTime)} / ${formatDuration(duration)}`
            : formatDuration(duration)}
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
