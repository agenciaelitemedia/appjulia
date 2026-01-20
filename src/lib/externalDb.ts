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
}

export const externalDb = new ExternalDatabase();
