import { useCallback, useEffect, useRef, useState } from 'react';
import { Invitation, Inviter, Registerer, RegistererState, SessionState, UserAgent, UserAgentOptions } from 'sip.js';

export type SipStatus = 'idle' | 'registering' | 'registered' | 'calling' | 'ringing' | 'in-call' | 'error';

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
  connect: (creds: SipCredentials) => void;
  disconnect: () => void;
  call: (target: string) => void;
  answer: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDTMF: (digit: string) => void;
}

export function useSipPhone(): UseSipPhoneReturn {
  const [status, setStatus] = useState<SipStatus>('idle');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isHeld, setIsHeld] = useState(false);
  const [callerInfo, setCallerInfo] = useState('');

  const uaRef = useRef<UserAgent | null>(null);
  const registererRef = useRef<Registerer | null>(null);
  const sessionRef = useRef<Inviter | Invitation | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const credsRef = useRef<SipCredentials | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

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
          startTimer();
          // Attach remote audio
          const remoteStream = new MediaStream();
          session.sessionDescriptionHandler?.peerConnection?.getReceivers().forEach((receiver) => {
            if (receiver.track) remoteStream.addTrack(receiver.track);
          });
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
          }
          break;
        case SessionState.Terminated:
          setStatus(registererRef.current?.state === RegistererState.Registered ? 'registered' : 'idle');
          stopTimer();
          setIsMuted(false);
          setIsHeld(false);
          setCallerInfo('');
          sessionRef.current = null;
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
          }
          break;
      }
    });
  }, [startTimer, stopTimer]);

  const connect = useCallback((creds: SipCredentials) => {
    credsRef.current = creds;
    setStatus('registering');

    const uri = UserAgent.makeURI(`sip:${creds.username}@${creds.domain}`);
    if (!uri) {
      setStatus('error');
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
          setupSessionListeners(invitation);

          // Auto-answer api4com integrated calls
          const headers = invitation.request.getHeaders('X-Api4comintegratedcall');
          if (headers?.length && headers[0] === 'true') {
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
          break;
        case RegistererState.Unregistered:
          setStatus('idle');
          break;
      }
    });

    ua.start().then(() => {
      registerer.register().catch(() => setStatus('error'));
    }).catch(() => setStatus('error'));
  }, [setupSessionListeners]);

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
    const pc = sessionRef.current.sessionDescriptionHandler?.peerConnection;
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
    const pc = sessionRef.current.sessionDescriptionHandler?.peerConnection;
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
    const pc = sessionRef.current.sessionDescriptionHandler?.peerConnection;
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
