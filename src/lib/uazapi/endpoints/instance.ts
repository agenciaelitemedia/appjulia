// ============================================
// Instance Endpoints
// WhatsApp instance status and connection
// ============================================

import { UaZapiClient } from '../client';
import type { ApiResponse, InstanceInfo, QRCodeResponse, InstanceStatus } from '../types';

export interface InstanceEndpoints {
  /**
   * Get instance connection status
   * GET /instance/status
   */
  getStatus: () => Promise<{ status: InstanceStatus }>;
  
  /**
   * Get instance info (phone, name, etc)
   * GET /instance/info
   */
  getInfo: () => Promise<InstanceInfo>;
  
  /**
   * Get QR Code for connection
   * GET /instance/qrcode
   */
  getQRCode: () => Promise<QRCodeResponse>;
  
  /**
   * Connect the instance
   * POST /instance/connect
   */
  connect: () => Promise<ApiResponse>;
  
  /**
   * Disconnect the instance
   * POST /instance/disconnect
   */
  disconnect: () => Promise<ApiResponse>;
  
  /**
   * Logout (clear session)
   * POST /instance/logout
   */
  logout: () => Promise<ApiResponse>;
  
  /**
   * Restart the instance
   * POST /instance/restart
   */
  restart: () => Promise<ApiResponse>;
  
  /**
   * Get profile picture URL
   * POST /instance/profilepic
   */
  getProfilePicture: (number: string, preview?: boolean) => Promise<ApiResponse<string>>;
  
  /**
   * Update own profile picture
   * POST /instance/updateProfilePic
   */
  updateProfilePicture: (imageBase64: string) => Promise<ApiResponse>;
  
  /**
   * Update own status/about text
   * POST /instance/updateStatus
   */
  updateStatus: (status: string) => Promise<ApiResponse>;
  
  /**
   * Update own display name
   * POST /instance/updateName
   */
  updateName: (name: string) => Promise<ApiResponse>;
}

export function createInstanceEndpoints(client: UaZapiClient | null): InstanceEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    async getStatus(): Promise<{ status: InstanceStatus }> {
      return assertClient().get<{ status: InstanceStatus }>('/instance/status');
    },

    async getInfo(): Promise<InstanceInfo> {
      return assertClient().get<InstanceInfo>('/instance/info');
    },

    async getQRCode(): Promise<QRCodeResponse> {
      return assertClient().get<QRCodeResponse>('/instance/qrcode');
    },

    async connect(): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/connect');
    },

    async disconnect(): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/disconnect');
    },

    async logout(): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/logout');
    },

    async restart(): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/restart');
    },

    async getProfilePicture(number: string, preview = false): Promise<ApiResponse<string>> {
      return assertClient().post<ApiResponse<string>>('/instance/profilepic', { number, preview });
    },

    async updateProfilePicture(imageBase64: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/updateProfilePic', { image: imageBase64 });
    },

    async updateStatus(status: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/updateStatus', { status });
    },

    async updateName(name: string): Promise<ApiResponse> {
      return assertClient().post<ApiResponse>('/instance/updateName', { name });
    },
  };
}
