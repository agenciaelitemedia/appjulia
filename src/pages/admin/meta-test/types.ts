export interface EventLogEntry {
  id: string;
  timestamp: Date;
  type: string;
  data?: Record<string, unknown>;
}

export interface SignupData {
  waba_id?: string;
  phone_number_id?: string;
  code?: string;
}

export interface TokenData {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

export interface WebhookLogEntry {
  id: string;
  from: string;
  message: string;
  timestamp: string;
}

// Facebook SDK types
declare global {
  interface Window {
    FB: {
      init: (params: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            code?: string;
            accessToken?: string;
          };
          status?: string;
        }) => void,
        options?: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          extras?: {
            sessionInfoVersion?: number;
            feature?: string;
          };
        }
      ) => void;
      getLoginStatus: (callback: (response: { status: string }) => void) => void;
    };
    fbAsyncInit: () => void;
  }
}
