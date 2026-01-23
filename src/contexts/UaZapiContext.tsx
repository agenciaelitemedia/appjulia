import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  UaZapiClient,
  createAgentEndpoints,
  createBusinessEndpoints,
  createCallEndpoints,
  createChatEndpoints,
  createChatwootEndpoints,
  createGroupEndpoints,
  createInstanceEndpoints,
  createLabelsEndpoints,
  createMessageEndpoints,
  type AgentEndpoints,
  type BusinessEndpoints,
  type CallEndpoints,
  type ChatEndpoints,
  type ChatwootEndpoints,
  type GroupEndpoints,
  type InstanceEndpoints,
  type LabelsEndpoints,
  type MessageEndpoints,
} from '@/lib/uazapi';

// ============================================
// Context Type Definition
// ============================================

export interface UaZapiContextType {
  /** Whether the UaZapi API is configured with valid credentials */
  isConfigured: boolean;
  
  /** The underlying HTTP client (for advanced use cases) */
  client: UaZapiClient | null;
  
  /** AI Agent configuration endpoints */
  agent: AgentEndpoints;
  
  /** Business profile and catalog endpoints */
  business: BusinessEndpoints;
  
  /** Voice call endpoints */
  call: CallEndpoints;
  
  /** Chat management endpoints */
  chat: ChatEndpoints;
  
  /** Chatwoot integration endpoints */
  chatwoot: ChatwootEndpoints;
  
  /** Groups and communities endpoints */
  group: GroupEndpoints;
  
  /** Instance status and connection endpoints */
  instance: InstanceEndpoints;
  
  /** Labels/tags endpoints */
  labels: LabelsEndpoints;
  
  /** Message sending endpoints */
  message: MessageEndpoints;
}

// ============================================
// Context Creation
// ============================================

const UaZapiContext = createContext<UaZapiContextType | undefined>(undefined);

// ============================================
// Provider Component
// ============================================

interface UaZapiProviderProps {
  children: ReactNode;
}

export function UaZapiProvider({ children }: UaZapiProviderProps) {
  const { user } = useAuth();

  // Create the HTTP client based on user credentials
  const client = useMemo(() => {
    if (!user?.evo_url || !user?.evo_apikey) {
      return null;
    }

    return new UaZapiClient({
      baseUrl: user.evo_url,
      token: user.evo_apikey,
      instance: user.evo_instance,
    });
  }, [user?.evo_url, user?.evo_apikey, user?.evo_instance]);

  // Create all endpoint handlers
  const value = useMemo<UaZapiContextType>(() => ({
    isConfigured: !!client,
    client,
    agent: createAgentEndpoints(client),
    business: createBusinessEndpoints(client),
    call: createCallEndpoints(client),
    chat: createChatEndpoints(client),
    chatwoot: createChatwootEndpoints(client),
    group: createGroupEndpoints(client),
    instance: createInstanceEndpoints(client),
    labels: createLabelsEndpoints(client),
    message: createMessageEndpoints(client),
  }), [client]);

  return (
    <UaZapiContext.Provider value={value}>
      {children}
    </UaZapiContext.Provider>
  );
}

// ============================================
// Hook Export
// ============================================

export function useUaZapiContext(): UaZapiContextType {
  const context = useContext(UaZapiContext);
  if (context === undefined) {
    throw new Error('useUaZapiContext must be used within a UaZapiProvider');
  }
  return context;
}
