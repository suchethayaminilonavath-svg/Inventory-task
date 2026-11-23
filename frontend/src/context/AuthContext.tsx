import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types.js';
import { api } from '../api/client.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  loginAsRole: (role: Role) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('stockpilot_token'));
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      if (token) {
        try {
          const res = await api.get<{ user: User }>('/auth/me');
          setUser(res.user);
        } catch {
          // Token expired or invalid
          localStorage.removeItem('stockpilot_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    }
    loadUser();
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('stockpilot_token', newToken);
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem('stockpilot_token');
    setToken(null);
    setUser(null);
  };

  const loginAsRole = async (role: Role) => {
    const roleEmailMap: Record<Role, string> = {
      ADMIN: 'admin@stockpilot.io',
      WAREHOUSE_MANAGER: 'manager@stockpilot.io',
      INVENTORY_OPERATOR: 'operator@stockpilot.io',
      AUDITOR: 'auditor@stockpilot.io',
    };

    const email = roleEmailMap[role];
    const res = await api.post<{ token: string; user: User }>('/auth/login', {
      email,
      password: 'password123',
    });

    login(res.token, res.user);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loginAsRole, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
