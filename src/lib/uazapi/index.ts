// ============================================
// UaZapi Library - Central Export
// ============================================

// Client
export { UaZapiClient, UaZapiError } from './client';
export type { UaZapiConfig, RequestOptions } from './client';

// Types
export * from './types';

// Endpoints
export { createAgentEndpoints } from './endpoints/agent';
export type { AgentEndpoints } from './endpoints/agent';

export { createBusinessEndpoints } from './endpoints/business';
export type { BusinessEndpoints } from './endpoints/business';

export { createCallEndpoints } from './endpoints/call';
export type { CallEndpoints } from './endpoints/call';

export { createChatEndpoints } from './endpoints/chat';
export type { ChatEndpoints } from './endpoints/chat';

export { createChatwootEndpoints } from './endpoints/chatwoot';
export type { ChatwootEndpoints } from './endpoints/chatwoot';

export { createGroupEndpoints } from './endpoints/group';
export type { GroupEndpoints } from './endpoints/group';

export { createInstanceEndpoints } from './endpoints/instance';
export type { InstanceEndpoints } from './endpoints/instance';

export { createLabelsEndpoints } from './endpoints/labels';
export type { LabelsEndpoints } from './endpoints/labels';

export { createMessageEndpoints } from './endpoints/message';
export type { MessageEndpoints } from './endpoints/message';
