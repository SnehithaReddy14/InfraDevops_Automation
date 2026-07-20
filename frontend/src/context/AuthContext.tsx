import React, { createContext, useState, useEffect } from 'react';
import api from '../utils/api';

interface User {
  id: number;
  email: string;
  name: string;
  role: 'ADMIN' | 'FINANCE_MANAGER' | 'EMPLOYEE' | 'AUDITOR';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeUser = async () => {
      const token = localStorage.getItem('token');
      
      const performAutoLogin = async () => {
        try {
          const response = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: 'admin@company.com',
              password: 'password123',
            }),
          });
          
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            setUser(data.user);
          }
        } catch (err) {
          console.error('[AuthContext] Failed to auto-login', err);
        }
      };

      if (token) {
        try {
          const response = await fetch('http://localhost:5000/api/auth/me', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
          } else {
            await performAutoLogin();
          }
        } catch (err) {
          console.error('[AuthContext] Failed to load profile', err);
          await performAutoLogin();
        }
      } else {
        await performAutoLogin();
      }
      setLoading(false);
    };

    initializeUser();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string, name: string, role: string) => {
    setLoading(true);
    try {
      const data = await api.post('/auth/register', { email, password, name, role });
      localStorage.setItem('token', data.token);
      localStorage.setItem('refreshToken', data.refreshToken);
      setUser(data.user);
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
