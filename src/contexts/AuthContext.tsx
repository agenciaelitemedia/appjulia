import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { externalDb } from '@/lib/externalDb';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  payment_status?: string;
  avatar?: string;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const storedUser = localStorage.getItem('julia_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('julia_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      // Query users table for authentication
      const users = await externalDb.raw<User>({
        query: `
          SELECT id, name, email, role, status, payment_status, avatar, created_at 
          FROM users 
          WHERE email = $1 AND password = crypt($2, password)
          LIMIT 1
        `,
        params: [email, password],
      });

      if (users.length === 0) {
        return { success: false, error: 'Credenciais inválidas' };
      }

      const authenticatedUser = users[0];

      // Check payment status
      if (authenticatedUser.payment_status === 'overdue') {
        return { success: false, error: 'Pagamento pendente. Entre em contato com o suporte.' };
      }

      // Check if user is active
      if (authenticatedUser.status !== 'active') {
        return { success: false, error: 'Conta inativa. Entre em contato com o suporte.' };
      }

      setUser(authenticatedUser);
      localStorage.setItem('julia_user', JSON.stringify(authenticatedUser));
      
      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Erro ao fazer login' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('julia_user');
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
