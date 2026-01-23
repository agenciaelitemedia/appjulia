// ============================================
// UaZapi HTTP Client
// Base client for all API requests
// ============================================

export interface UaZapiConfig {
  baseUrl: string;
  token: string;
  instance?: string;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
}

export class UaZapiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'UaZapiError';
  }
}

export class UaZapiClient {
  private config: UaZapiConfig;
  private defaultTimeout = 30000;
  private defaultRetries = 2;

  constructor(config: UaZapiConfig) {
    this.config = config;
  }

  get baseUrl(): string {
    return this.config.baseUrl;
  }

  get token(): string {
    return this.config.token;
  }

  get instance(): string | undefined {
    return this.config.instance;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: object,
    options?: RequestOptions
  ): Promise<T> {
    const { timeout = this.defaultTimeout, retries = this.defaultRetries } = options || {};
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const url = `${this.config.baseUrl}${endpoint}`;
        
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'token': this.config.token,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          let errorData: Record<string, unknown> = {};
          try {
            errorData = await response.json();
          } catch {
            // Response might not be JSON
          }
          
          throw new UaZapiError(
            (errorData.error as string) || `HTTP Error ${response.status}`,
            response.status,
            errorData
          );
        }

        // Handle empty responses
        const text = await response.text();
        if (!text) {
          return {} as T;
        }

        try {
          return JSON.parse(text) as T;
        } catch {
          return { response: text } as T;
        }
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on client errors (4xx)
        if (error instanceof UaZapiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Don't retry on abort
        if (error instanceof Error && error.name === 'AbortError') {
          throw new UaZapiError('Request timeout', 408);
        }
        
        // Wait before retry with exponential backoff
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000);
        }
      }
    }
    
    throw lastError || new UaZapiError('Unknown error');
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('GET', endpoint, undefined, options);
  }

  async post<T>(endpoint: string, body?: object, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', endpoint, body, options);
  }

  async put<T>(endpoint: string, body?: object, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', endpoint, body, options);
  }

  async delete<T>(endpoint: string, body?: object, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', endpoint, body, options);
  }
}
