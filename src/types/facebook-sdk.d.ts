// Facebook SDK global types
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
            featureType?: string;
          };
        }
      ) => void;
      getLoginStatus: (callback: (response: { status: string }) => void) => void;
    };
    fbAsyncInit: () => void;
  }
}


