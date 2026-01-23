// ============================================
// Business Endpoints
// Catalog and commercial profile management
// ============================================

import { UaZapiClient } from '../client';
import type {
  ApiResponse,
  CatalogProduct,
  BusinessCategory,
  BusinessProfile,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from '../types';

export interface BusinessEndpoints {
  catalog: {
    /**
     * Delete a product from catalog
     * POST /business/catalog/delete
     */
    delete: (id: string) => Promise<ApiResponse<string>>;
    
    /**
     * Hide a product from catalog
     * POST /business/catalog/hide
     */
    hide: (id: string) => Promise<ApiResponse<string>>;
    
    /**
     * Get product info
     * POST /business/catalog/info
     */
    info: (jid: string, id: string) => Promise<ApiResponse<CatalogProduct>>;
    
    /**
     * List all products in catalog
     * POST /business/catalog/list
     */
    list: (jid: string) => Promise<ApiResponse<CatalogProduct[]>>;
    
    /**
     * Show a hidden product
     * POST /business/catalog/show
     */
    show: (id: string) => Promise<ApiResponse<string>>;
  };
  
  /**
   * Get business categories
   * GET /business/get/categories
   */
  getCategories: () => Promise<ApiResponse<BusinessCategory[]>>;
  
  /**
   * Get business profile
   * POST /business/get/profile
   */
  getProfile: (jid: string) => Promise<ApiResponse<BusinessProfile>>;
  
  /**
   * Update business profile
   * POST /business/update/profile
   */
  updateProfile: (data: UpdateProfileRequest) => Promise<UpdateProfileResponse>;
}

export function createBusinessEndpoints(client: UaZapiClient | null): BusinessEndpoints {
  const assertClient = (): UaZapiClient => {
    if (!client) {
      throw new Error('UaZapi client not configured');
    }
    return client;
  };

  return {
    catalog: {
      async delete(id: string): Promise<ApiResponse<string>> {
        return assertClient().post<ApiResponse<string>>('/business/catalog/delete', { id });
      },

      async hide(id: string): Promise<ApiResponse<string>> {
        return assertClient().post<ApiResponse<string>>('/business/catalog/hide', { id });
      },

      async info(jid: string, id: string): Promise<ApiResponse<CatalogProduct>> {
        return assertClient().post<ApiResponse<CatalogProduct>>('/business/catalog/info', { jid, id });
      },

      async list(jid: string): Promise<ApiResponse<CatalogProduct[]>> {
        return assertClient().post<ApiResponse<CatalogProduct[]>>('/business/catalog/list', { jid });
      },

      async show(id: string): Promise<ApiResponse<string>> {
        return assertClient().post<ApiResponse<string>>('/business/catalog/show', { id });
      },
    },

    async getCategories(): Promise<ApiResponse<BusinessCategory[]>> {
      return assertClient().get<ApiResponse<BusinessCategory[]>>('/business/get/categories');
    },

    async getProfile(jid: string): Promise<ApiResponse<BusinessProfile>> {
      return assertClient().post<ApiResponse<BusinessProfile>>('/business/get/profile', { jid });
    },

    async updateProfile(data: UpdateProfileRequest): Promise<UpdateProfileResponse> {
      return assertClient().post<UpdateProfileResponse>('/business/update/profile', data);
    },
  };
}
