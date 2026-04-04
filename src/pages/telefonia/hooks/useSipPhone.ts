import { useCallback, useEffect, useRef, useState } from 'react';
import JsSIP from 'jssip';
import type { RTCSession } from 'jssip/lib/RTCSession';

export type SipStatus = 'idle' | 'registering' | 'registered' | 'calling' | 'ringing' | 'in-call' | 'error';

export interface CallEndedInfo {
  duration: number;
  callerInfo: string;
  startedAt: string | null;
  endedAt: string;
}

export type OnCallEndedCallback = (info: CallEndedInfo) => void;

export interface SipDiagnostics {
  domain: string;
  domainSource: string;
  wsUrl: string;
  wsUrlSource: string;
  username: string;
  registrationStatus: string;
  lastError: string;
  wsState: string;
  events: string[];
}

interface SipCredentials {
  domain: string;
  domainSource?: string;
  username: string;
  password: string;
  wsUrl: string;
  wsUrlSource?: string;
  wsUrlCandidates?: string[];
}

interface UseSipPhoneReturn {
  status: SipStatus;
  duration: number;
  isMuted: boolean;
  isHeld: boolean;
  callerInfo: string;
  diagnostics: SipDiagnostics;
  connect: (creds: SipCredentials) => void;
  disconnect: () => void;
  call: (target: string) => void;
  answer: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDTMF: (digit: string) => void;
}

export function useSipPhone(onCallEnded?: OnCallEndedCallback, onCallFailed?: (cause: string) => void, isDialingRef?: React.RefObject<boolean>): UseSipPhoneReturn {
  const [status, setStatus] = useState<SipStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [callerInfo, setCallerInfo] = useState('');
  const [diagnostics, setDiagnostics] = useState<SipDiagnostics>({
    domain: '', domainSource: '', wsUrl: '', wsUrlSource: '', username: '', registrationStatus: 'none',
    lastError: '', wsState: 'disconnected', events: [],
  });

  const addDiagEvent = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('pt-BR');
    setDiagnostics(prev => ({
      ...prev,
      events: [`[${ts}] ${msg}`, ...prev.events].slice(0, 30),
    }));
  }, []);

  const uaRef = useRef<JsSIP.UA | null>(null);
  const sessionRef = useRef<RTCSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringtoneRef = useRef<{ ctx: AudioContext; osc: OscillatorNode; gain: GainNode; interval: ReturnType<typeof setInterval> } | null>(null);

  const startRingtone = useCallback(() => {
    stopRingtone();
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      // Brazilian phone ring pattern: 1s on, 4s off
      let on = true;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      const interval = setInterval(() => {
        on = !on;
        gain.gain.setValueAtTime(on ? 0.15 : 0, ctx.currentTime);
      }, on ? 1000 : 4000);
      // Use alternating pattern: ring 1s, silence 4s
      clearInterval(interval);
      let phase = 0;
      const ringInterval = setInterval(() => {
        phase++;
        const isRing = phase % 5 === 1 || phase % 5 === 2; // ~1s ring out of 2.5s cycle
        gain.gain.setValueAtTime(isRing ? 0.12 : 0, ctx.currentTime);
      }, 500);
      ringtoneRef.current = { ctx, osc, gain, interval: ringInterval };
    } catch {
      // AudioContext not available
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.osc.stop();
        clearInterval(ringtoneRef.current.interval);
        ringtoneRef.current.ctx.close();
      } catch { /* ignore */ }
      ringtoneRef.current = null;
    }
  }, []);
  const credsRef = useRef<SipCredentials | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStartedAtRef = useRef<string | null>(null);
  const callerInfoRef = useRef<string>('');
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;
  const onCallFailedRef = useRef(onCallFailed);
  onCallFailedRef.current = onCallFailed;
  const durationRef = useRef(0);

  const getOrCreateAudio = useCallback(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return remoteAudioRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (remoteAudioRef.current) {
        document.body.removeChild(remoteAudioRef.current);
        remoteAudioRef.current = null;
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    setDuration(0);
    durationRef.current = 0;
    timerRef.current = setInterval(() => {
      setDuration((d) => {
        durationRef.current = d + 1;
        return d + 1;
      });
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDuration(0);
  }, []);

  const fireCallEnded = useCallback(() => {
    const endedAt = new Date().toISOString();
    const callDuration = durationRef.current;
    const savedCallerInfo = callerInfoRef.current;
    const savedStartedAt = callStartedAtRef.current;

    if (onCallEndedRef.current && (savedStartedAt || savedCallerInfo)) {
      try {
        onCallEndedRef.current({
          duration: callDuration,
          callerInfo: savedCallerInfo,
          startedAt: savedStartedAt,
          endedAt,
        });
      } catch (e) {
        console.error('onCallEnded callback error:', e);
      }
    }
  }, []);

  const cleanupSession = useCallback(() => {
    fireCallEnded();
    stopRingtone();
    const isRegistered = uaRef.current?.isRegistered();
    setStatus(isRegistered ? 'registered' : 'idle');
    stopTimer();
    setIsMuted(false);
    setIsHeld(false);
    setCallerInfo('');
    sessionRef.current = null;
    callStartedAtRef.current = null;
    callerInfoRef.current = '';
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, [stopTimer, fireCallEnded, stopRingtone]);

  const attachSessionEvents = useCallback((session: RTCSession) => {
    session.on('progress', () => {
      setStatus('ringing');
      startRingtone();
      addDiagEvent('Call progress (ringing)');
    });

    session.on('accepted', () => {
      stopRingtone();
      setStatus('in-call');
      callStartedAtRef.current = new Date().toISOString();
      startTimer();
      addDiagEvent('Call accepted');
    });

    session.on('peerconnection', (evt: any) => {
      const pc: RTCPeerConnection = evt.peerconnection;
      pc.ontrack = (trackEvt) => {
        const audioEl = getOrCreateAudio();
        if (trackEvt.streams && trackEvt.streams[0]) {
          audioEl.srcObject = trackEvt.streams[0];
        } else {
          const stream = new MediaStream();
          stream.addTrack(trackEvt.track);
          audioEl.srcObject = stream;
        }
      };
    });

    session.on('ended', () => {
      addDiagEvent('Call ended');
      cleanupSession();
    });

    session.on('failed', (evt: any) => {
      const cause = evt?.cause || 'Unknown';
      addDiagEvent(`Call failed: ${cause}`);
      onCallFailedRef.current?.(cause);
      cleanupSession();
    });

    session.on('hold', () => {
      setIsHeld(true);
      addDiagEvent('Call on hold');
    });

    session.on('unhold', () => {
      setIsHeld(false);
      addDiagEvent('Call resumed');
    });
  }, [startTimer, startRingtone, stopRingtone, cleanupSession, getOrCreateAudio, addDiagEvent]);

  // Probe a single WebSocket URL — resolves true if connection opens, false on error/timeout
  const probeWs = useCallback((url: string, timeoutMs = 4000): Promise<boolean> => {
    return new Promise((resolve) => {
      try {
        const ws = new WebSocket(url);
        const timer = setTimeout(() => { try { ws.close(); } catch {} resolve(false); }, timeoutMs);
        ws.onopen = () => { clearTimeout(timer); try { ws.close(); } catch {} resolve(true); };
        ws.onerror = () => { clearTimeout(timer); try { ws.close(); } catch {} resolve(false); };
        ws.onclose = () => { clearTimeout(timer); resolve(false); };
      } catch { resolve(false); }
    });
  }, []);

  // Probe multiple WSS URLs and return the first that connects
  const findWorkingWss = useCallback(async (candidates: string[]): Promise<{ url: string; index: number } | null> => {
    for (let i = 0; i < candidates.length; i++) {
      addDiagEvent(`Testando WSS: ${candidates[i]}...`);
      const ok = await probeWs(candidates[i]);
      if (ok) {
        addDiagEvent(`✓ WSS funcionando: ${candidates[i]}`);
        return { url: candidates[i], index: i };
      }
      addDiagEvent(`✗ WSS falhou: ${candidates[i]}`);
    }
    return null;
  }, [probeWs, addDiagEvent]);

  const connect = useCallback(async (creds: SipCredentials) => {
    // Disconnect existing UA if any
    if (uaRef.current) {
      try { uaRef.current.stop(); } catch { /* ignore */ }
      uaRef.current = null;
    }

    credsRef.current = creds;
    setStatus('registering');
    setDiagnostics(prev => ({
      ...prev,
      domain: creds.domain,
      domainSource: creds.domainSource || '',
      wsUrl: creds.wsUrl,
      wsUrlSource: creds.wsUrlSource || '',
      username: creds.username,
      registrationStatus: 'connecting',
      wsState: 'connecting',
      lastError: '',
    }));

    // If we have WSS candidates, probe them to find a working one
    let finalWsUrl = creds.wsUrl;
    let finalWsSource = creds.wsUrlSource || '';

    if (creds.wsUrlCandidates && creds.wsUrlCandidates.length > 0) {
      addDiagEvent(`Iniciando auto-discovery WSS (${creds.wsUrlCandidates.length} candidatos)...`);
      const found = await findWorkingWss(creds.wsUrlCandidates);
      if (found) {
        finalWsUrl = found.url;
        finalWsSource = `auto-discovery candidato #${found.index + 1}`;
        addDiagEvent(`WSS selecionado: ${finalWsUrl}`);
      } else {
        addDiagEvent('Nenhum WSS candidato respondeu. Usando primeiro como fallback.');
        finalWsUrl = creds.wsUrlCandidates[0];
        finalWsSource = 'fallback (nenhum respondeu)';
      }
    }

    setDiagnostics(prev => ({
      ...prev,
      wsUrl: finalWsUrl,
      wsUrlSource: finalWsSource,
    }));

    addDiagEvent(`Connecting to ${finalWsUrl} as ${creds.username}@${creds.domain}`);

    const socket = new JsSIP.WebSocketInterface(finalWsUrl);

    const ua = new JsSIP.UA({
      sockets: [socket],
      uri: `sip:${creds.username}@${creds.domain}`,
      password: creds.password,
      display_name: creds.username,
      register: true,
      register_expires: 600,
      session_timers: false,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
      user_agent: 'JuliaWebphone/1.0',
    });

    ua.on('connected', () => {
      addDiagEvent('WebSocket connected');
      setDiagnostics(prev => ({ ...prev, wsState: 'connected' }));
    });

    ua.on('disconnected', () => {
      addDiagEvent('WebSocket disconnected');
      setDiagnostics(prev => ({ ...prev, wsState: 'disconnected' }));
    });

    ua.on('registered', () => {
      setStatus('registered');
      addDiagEvent('✓ SIP Registered');
      setDiagnostics(prev => ({ ...prev, registrationStatus: 'registered', wsState: 'connected' }));
    });

    ua.on('unregistered', () => {
      setStatus('idle');
      addDiagEvent('SIP Unregistered');
      setDiagnostics(prev => ({ ...prev, registrationStatus: 'unregistered' }));
    });

    ua.on('registrationFailed', (evt: any) => {
      const cause = evt?.cause || 'Registration failed';
      setStatus('error');
      addDiagEvent(`ERROR register: ${cause}`);
      setDiagnostics(prev => ({ ...prev, lastError: cause, registrationStatus: 'error' }));
    });

    ua.on('newRTCSession', (evt: any) => {
      const session: RTCSession = evt.session;

      // Only handle incoming calls here
      if (session.direction !== 'incoming') return;

      sessionRef.current = session;
      const incomingCaller = session.remote_identity?.uri?.user || 'Desconhecido';
      setCallerInfo(incomingCaller);
      callerInfoRef.current = incomingCaller;
      setStatus('ringing');
      addDiagEvent(`Incoming call from ${incomingCaller}`);
      attachSessionEvents(session);

      // Auto-answer: either integrated call header OR active dialing (PBX callback)
      const shouldAutoAnswer = (() => {
        if (isDialingRef?.current) {
          addDiagEvent('Auto-answering: active dial detected');
          return true;
        }
        const request = (session as any).request;
        if (request) {
          const integratedHeader = request.getHeader?.('X-Api4comintegratedcall');
          if (integratedHeader === 'true') {
            addDiagEvent('Auto-answering: integrated call header');
            return true;
          }
        }
        return false;
      })();

      if (shouldAutoAnswer) {
        session.answer({
          mediaConstraints: { audio: true, video: false },
        });
      }
    });

    uaRef.current = ua;

    try {
      ua.start();
    } catch (err: any) {
      setStatus('error');
      const msg = err?.message || 'Failed to start UA';
      addDiagEvent(`ERROR start: ${msg}`);
      setDiagnostics(prev => ({ ...prev, lastError: msg, wsState: 'error', registrationStatus: 'error' }));
    }
  }, [attachSessionEvents, addDiagEvent, findWorkingWss]);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      try { sessionRef.current.terminate(); } catch { /* ignore */ }
    }
    if (uaRef.current) {
      try { uaRef.current.stop(); } catch { /* ignore */ }
      uaRef.current = null;
    }
    sessionRef.current = null;
    setStatus('idle');
    stopTimer();
  }, [stopTimer]);

  const call = useCallback((target: string) => {
    if (!uaRef.current || !credsRef.current) return;

    setCallerInfo(target);
    callerInfoRef.current = target;
    setStatus('calling');

    const session = uaRef.current.call(`sip:${target}@${credsRef.current.domain}`, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
    });

    sessionRef.current = session;
    attachSessionEvents(session);
  }, [attachSessionEvents]);

  const answer = useCallback(() => {
    if (sessionRef.current && sessionRef.current.direction === 'incoming') {
      sessionRef.current.answer({
        mediaConstraints: { audio: true, video: false },
      });
    }
  }, []);

  const hangup = useCallback(() => {
    if (!sessionRef.current) return;
    try {
      sessionRef.current.terminate();
    } catch { /* already terminated */ }
  }, []);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    if (sessionRef.current.isMuted().audio) {
      sessionRef.current.unmute({ audio: true });
      setIsMuted(false);
    } else {
      sessionRef.current.mute({ audio: true });
      setIsMuted(true);
    }
  }, []);

  const toggleHold = useCallback(() => {
    if (!sessionRef.current) return;
    if (sessionRef.current.isOnHold().local) {
      sessionRef.current.unhold();
    } else {
      sessionRef.current.hold();
    }
  }, []);

  const sendDTMF = useCallback((digit: string) => {
    if (!sessionRef.current || !sessionRef.current.isEstablished()) return;
    sessionRef.current.sendDTMF(digit, {
      duration: 100,
      interToneGap: 70,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    duration,
    isMuted,
    isHeld,
    callerInfo,
    diagnostics,
    connect,
    disconnect,
    call,
    answer,
    hangup,
    toggleMute,
    toggleHold,
    sendDTMF,
  };
}
