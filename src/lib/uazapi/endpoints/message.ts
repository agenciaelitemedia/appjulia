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
  DownloadMediaRequest,
  DownloadMediaResponse,
} from '../types';

export interface MessageEndpoints {
  /**
   * Send a text message
   * POST /send/text
   */
  sendText: (data: SendTextRequest) => Promise<MessageResponse>;
  
  /**
   * Send an image message
   * POST /send/media (type: image)
   */
  sendImage: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a video message
   * POST /send/media (type: video)
   */
  sendVideo: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send an audio message
   * POST /send/media (type: audio)
   */
  sendAudio: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a document
   * POST /send/media (type: document)
   */
  sendDocument: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a sticker
   * POST /send/media (type: sticker)
   */
  sendSticker: (data: SendMediaRequest) => Promise<MessageResponse>;
  
  /**
   * Send a location
   * POST /send/location
   */
  sendLocation: (data: SendLocationRequest) => Promise<MessageResponse>;
  
  /**
   * Send a contact card
   * POST /send/contact
   */
  sendContact: (data: SendContactRequest) => Promise<MessageResponse>;
  
  /**
   * Send interactive buttons
   * POST /send/menu
   */
  sendButtons: (data: SendButtonsRequest) => Promise<MessageResponse>;
  
  /**
   * Send an interactive list
   * POST /send/menu
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
  
  /**
   * Download media from a message
   * POST /message/download
   */
  download: (data: DownloadMediaRequest) => Promise<DownloadMediaResponse>;
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
      return assertClient().post<MessageResponse>('/send/text', data);
    },

    async sendImage(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/media', { ...data, type: 'image' });
    },

    async sendVideo(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/media', { ...data, type: 'video' });
    },

    async sendAudio(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/media', { ...data, type: 'audio' });
    },

    async sendDocument(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/media', { ...data, type: 'document' });
    },

    async sendSticker(data: SendMediaRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/media', { ...data, type: 'sticker' });
    },

    async sendLocation(data: SendLocationRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/location', data);
    },

    async sendContact(data: SendContactRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/contact', data);
    },

    async sendButtons(data: SendButtonsRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/menu', data);
    },

    async sendList(data: SendListRequest): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/send/menu', data);
    },

    async react(messageId: string, emoji: string): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/react', { messageId, emoji });
    },

    async delete(messageId: string, everyone = true): Promise<MessageResponse> {
      return assertClient().post<MessageResponse>('/message/delete', { messageId, everyone });
    },

    async download(data: DownloadMediaRequest): Promise<DownloadMediaResponse> {
      return assertClient().post<DownloadMediaResponse>('/message/download', data);
    },
  };
}
