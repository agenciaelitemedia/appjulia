// ============================================
// Message Endpoints
// Send various types of messages
// ============================================

import { UaZapiClient } from '../client';
import type {
  SendTextRequest,
  SendMediaRequest,
  SendLocationRequest,
  SendContactRequest,
  SendButtonsRequest,
  SendListRequest,
  MessageResponse,
} from '../types';

export interface MessageEndpoints {
  /**
   * Send a text message
   * POST /message/text
   */
  sendText: (data: SendTextRequest) => Promise<MessageResponse>;
  
  /**
   * Send an image message
   * POST /message/image
   */
  sendImage: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a video message
   * POST /message/video
   */
  sendVideo: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send an audio message
   * POST /message/audio
   */
  sendAudio: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a document
   * POST /message/document
   */
  sendDocument: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a sticker
   * POST /message/sticker
   */
  sendSticker: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a location
   * POST /message/location
   */
  sendLocation: (data: SendLocationRequest) => Promise<MessageResponse>;
  
  /**
   * Send a contact card
   * POST /message/contact
   */
  sendContact: (data: SendContactRequest) => Promise<MessageResponse>;
  
  /**
   * Send interactive buttons
   * POST /message/buttons
   */
  sendButtons: (data: SendButtonsRequest) => Promise<MessageResponse>;
  
  /**
   * Send an interactive list
   * POST /message/list
   */
  sendList: (data: SendListRequest) => Promise<MessageResponse>;
  
  /**
   * React to a message
   * POST /message/react
   */
  react: (messageId: string, emoji: string) => Promise<MessageResponse>;
  
  /**
   * Delete/revoke a message
   * POST /message/delete
   */
  delete: (messageId: string, everyone?: boolean) => Promise<MessageResponse>;
}

export function createMessageEndpoints(client: UaZapiClient | null): MessageEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async sendText(data: SendTextRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/text', data);
    },

    async sendImage(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/image', data);
    },

    async sendVideo(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/video', data);
    },

    async sendAudio(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/audio', data);
    },

    async sendDocument(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/document', data);
    },

    async sendSticker(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/sticker', data);
    },

    async sendLocation(data: SendLocationRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/location', data);
    },

    async sendContact(data: SendContactRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/contact', data);
    },

    async sendButtons(data: SendButtonsRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/buttons', data);
    },

    async sendList(data: SendListRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/list', data);
    },

    async react(messageId: string, emoji: string): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/react', { messageId, emoji });
    },

    async delete(messageId: string, everyone = true): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/delete', { messageId, everyone });
    },
  };
}
