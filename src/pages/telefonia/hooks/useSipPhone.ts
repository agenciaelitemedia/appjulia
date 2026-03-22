import { useCallback, useEffect, useRef, useState } from 'react';
import { Invitation, Inviter, Registerer, RegistererState, SessionState, UserAgent, UserAgentOptions } from 'sip.js';

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
  wsUrl: string;
  username: string;
  registrationStatus: string;
  lastError: string;
  wsState: string;
  events: string[];
}

interface SipCredentials {
  domain: string;
  username: string;
  password: string;
  wsUrl: string;
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

export function useSipPhone(onCallEnded?: OnCallEndedCallback): UseSipPhoneReturn {
  const [status, setStatus] = useState<SipStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [callerInfo, setCallerInfo] = useState('');
  const [diagnostics, setDiagnostics] = useState<SipDiagnostics>({
    domain: '', wsUrl: '', username: '', registrationStatus: 'none',
    lastError: '', wsState: 'disconnected', events: [],
  });

  const addDiagEvent = useCallback((msg: string) => {
    const ts = new Date().toLocaleTimeString('pt-BR');
    setDiagnostics(prev => ({
      ...prev,
      events: [`[${ts}] ${msg}`, ...prev.events].slice(0, 20),
    }));
  }, []);

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Inviter | Invitation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const credsRef = useRef<SipCredentials | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const callStartedAtRef = useRef<string | null>(null);
  const callerInfoRef = useRef<string>('');
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;

  // Create audio element for remote audio
  useEffect(() => {
    if (!remoteAudioRef.current) {
      const audio = new Audio();
      audio.autoplay = true;
      document.body.appendChild(audio);
      remoteAudioRef.current = audio;
    }
    return () => {
      if (remoteAudioRef.current) {
        document.body.removeChild(remoteAudioRef.current);
        remoteAudioRef.current = null;
      }
    };
  }, []);

  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDuration(0);
  }, []);

  const setupSessionListeners = useCallback((session: Inviter | Invitation) => {
    session.stateChange.addListener((state: SessionState) => {
      switch (state) {
        case SessionState.Establishing:
          setStatus('ringing');
          break;
        case SessionState.Established:
          setStatus('in-call');
          callStartedAtRef.current = new Date().toISOString();
          startTimer();
          // Attach remote audio
          const remoteStream = new MediaStream();
          const pc = (session.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
          pc?.getReceivers().forEach((receiver) => {
            if (receiver.track) remoteStream.addTrack(receiver.track);
          });
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          break;
        case SessionState.Terminated: {
          const endedAt = new Date().toISOString();
          const callDuration = timerRef.current ? Math.max(0, duration) : 0;
          const savedCallerInfo = callerInfoRef.current;
          const savedStartedAt = callStartedAtRef.current;

          // Fire callback with call data
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

          setStatus(registererRef.current?.state === RegistererState.Registered ? 'registered' : 'idle');
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
          break;
        }
      }
    });
  }, [startTimer, stopTimer]);

  const connect = useCallback((creds: SipCredentials) => {
    credsRef.current = creds;
    setStatus('registering');
    setDiagnostics(prev => ({
      ...prev,
      domain: creds.domain,
      wsUrl: creds.wsUrl,
      username: creds.username,
      registrationStatus: 'connecting',
      wsState: 'connecting',
      lastError: '',
    }));
    addDiagEvent(`Connecting to ${creds.wsUrl} as ${creds.username}@${creds.domain}`);

    const uri = UserAgent.makeURI(`sip:${creds.username}@${creds.domain}`);
    if (!uri) {
      setStatus('error');
      addDiagEvent('ERROR: Invalid SIP URI');
      setDiagnostics(prev => ({ ...prev, lastError: 'Invalid SIP URI', registrationStatus: 'error' }));
      return;
    }

    const uaOptions: UserAgentOptions = {
      uri,
      transportOptions: {
        server: creds.wsUrl,
      },
      authorizationUsername: creds.username,
      authorizationPassword: creds.password,
      displayName: creds.username,
      delegate: {
        onInvite: (invitation: Invitation) => {
          sessionRef.current = invitation;
          setCallerInfo(invitation.remoteIdentity?.uri?.user || 'Desconhecido');
          setStatus('ringing');
          addDiagEvent(`Incoming call from ${invitation.remoteIdentity?.uri?.user || '?'}`);
          setupSessionListeners(invitation);

          const headers = invitation.request.getHeaders('X-Api4comintegratedcall');
          if (headers?.length && headers[0] === 'true') {
            addDiagEvent('Auto-answering integrated call');
            invitation.accept();
          }
        },
      },
    };

    const ua = new UserAgent(uaOptions);
    uaRef.current = ua;

    const registerer = new Registerer(ua, { expires: 600 });
    registererRef.current = registerer;

    registerer.stateChange.addListener((state: RegistererState) => {
      switch (state) {
        case RegistererState.Registered:
          setStatus('registered');
          addDiagEvent('✓ SIP Registered');
          setDiagnostics(prev => ({ ...prev, registrationStatus: 'registered', wsState: 'connected' }));
          break;
        case RegistererState.Unregistered:
          setStatus('idle');
          addDiagEvent('SIP Unregistered');
          setDiagnostics(prev => ({ ...prev, registrationStatus: 'unregistered' }));
          break;
      }
    });

    ua.start().then(() => {
      addDiagEvent('WebSocket connected, registering...');
      setDiagnostics(prev => ({ ...prev, wsState: 'connected', registrationStatus: 'registering' }));
      registerer.register().catch((err) => {
        setStatus('error');
        const msg = err?.message || 'Registration failed';
        addDiagEvent(`ERROR register: ${msg}`);
        setDiagnostics(prev => ({ ...prev, lastError: msg, registrationStatus: 'error' }));
      });
    }).catch((err) => {
      setStatus('error');
      const msg = err?.message || 'WebSocket connection failed';
      addDiagEvent(`ERROR connect: ${msg}`);
      setDiagnostics(prev => ({ ...prev, lastError: msg, wsState: 'error', registrationStatus: 'error' }));
    });
  }, [setupSessionListeners, addDiagEvent]);

  const disconnect = useCallback(() => {
    if (sessionRef.current?.state === SessionState.Established) {
      sessionRef.current.bye();
    }
    registererRef.current?.unregister().catch(() => {});
    uaRef.current?.stop().catch(() => {});
    uaRef.current = null;
    registererRef.current = null;
    sessionRef.current = null;
    setStatus('idle');
    stopTimer();
  }, [stopTimer]);

  const call = useCallback((target: string) => {
    if (!uaRef.current || !credsRef.current) return;
    const targetUri = UserAgent.makeURI(`sip:${target}@${credsRef.current.domain}`);
    if (!targetUri) return;

    const inviter = new Inviter(uaRef.current, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
      },
    });
    sessionRef.current = inviter;
    setCallerInfo(target);
    setStatus('calling');
    setupSessionListeners(inviter);

    inviter.invite().catch(() => setStatus('error'));
  }, [setupSessionListeners]);

  const answer = useCallback(() => {
    if (sessionRef.current && 'accept' in sessionRef.current) {
      (sessionRef.current as Invitation).accept();
    }
  }, []);

  const hangup = useCallback(() => {
    if (!sessionRef.current) return;
    const state = sessionRef.current.state;
    if (state === SessionState.Established) {
      sessionRef.current.bye();
    } else if (state === SessionState.Establishing || state === SessionState.Initial) {
      if ('cancel' in sessionRef.current) {
        (sessionRef.current as Inviter).cancel();
      } else if ('reject' in sessionRef.current) {
        (sessionRef.current as Invitation).reject();
      }
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!sessionRef.current) return;
    const pc = (sessionRef.current.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') {
        sender.track.enabled = isMuted;
      }
    });
    setIsMuted(!isMuted);
  }, [isMuted]);

  const toggleHold = useCallback(() => {
    // Hold via re-invite is complex; for now toggle audio direction
    if (!sessionRef.current) return;
    const pc = (sessionRef.current.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;
    pc.getSenders().forEach((sender) => {
      if (sender.track?.kind === 'audio') {
        sender.track.enabled = isHeld;
      }
    });
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track?.kind === 'audio') {
        receiver.track.enabled = isHeld;
      }
    });
    setIsHeld(!isHeld);
  }, [isHeld]);

  const sendDTMF = useCallback((digit: string) => {
    if (!sessionRef.current || sessionRef.current.state !== SessionState.Established) return;
    const pc = (sessionRef.current.sessionDescriptionHandler as any)?.peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;
    const sender = pc.getSenders().find((s) => s.track?.kind === 'audio');
    if (sender?.dtmf) {
      sender.dtmf.insertDTMF(digit, 100, 70);
    }
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
