import { supabase } from "@/integrations/supabase/client";

interface QueryOptions {
  table: string;
  select?: string;
  where?: Record<string, any>;
  limit?: number;
  offset?: number;
  orderBy?: string;
}

interface MutationOptions {
  table: string;
  data: Record<string, any>;
  where?: Record<string, any>;
}

interface RawQueryOptions {
  query: string;
  params?: any[];
}

class ExternalDatabase {
  private async invoke(payload: Record<string, any>) {
    const { data, error } = await supabase.functions.invoke('db-query', {
      body: payload,
    });

    if (error) throw error;
    if (data.error) throw new Error(data.error);
    
    return data.data;
  }

  async select<T = any>(options: QueryOptions): Promise<T[]> {
    return this.invoke({
      action: 'select',
      ...options,
    });
  }

  async insert<T = any>(options: MutationOptions): Promise<T> {
    return this.invoke({
      action: 'insert',
      table: options.table,
      data: options.data,
    });
  }

  async update<T = any>(options: MutationOptions): Promise<T> {
    if (!options.where) {
      throw new Error('WHERE clause is required for UPDATE operations');
    }
    return this.invoke({
      action: 'update',
      table: options.table,
      data: options.data,
      where: options.where,
    });
  }

  async delete<T = any>(options: { table: string; where: Record<string, any> }): Promise<T> {
    return this.invoke({
      action: 'delete',
      ...options,
    });
  }

  async raw<T = any>(options: RawQueryOptions): Promise<T[]> {
    return this.invoke({
      action: 'raw',
      data: options,
    });
  }

  async login<T = any>(email: string, password: string): Promise<T[]> {
    return this.invoke({
      action: 'login',
      data: { email, password },
    });
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    return this.invoke({
      action: 'change_password',
      data: { userId, currentPassword, newPassword },
    });
  }

  async getClient<T = any>(clientId: number): Promise<T | null> {
    const result = await this.invoke({
      action: 'get_client',
      data: { clientId },
    });
    return result.length > 0 ? result[0] : null;
  }

  async updateClient<T = any>(clientId: number, clientData: Record<string, any>): Promise<T> {
    const result = await this.invoke({
      action: 'update_client',
      data: { clientId, clientData },
    });
    return result[0];
  }
}

export interface Client {
  id: number;
  name: string | null;
  business_name: string | null;
  federal_id: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  zip_code: string | null;
  street: string | null;
  neighborhood: string | null;
  photo: string | null;
  created_at?: string;
  updated_at?: string;
}

export const externalDb = new ExternalDatabase();
