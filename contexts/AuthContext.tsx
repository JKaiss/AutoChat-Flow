
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { User, UsageStats, AuthContextType } from '../types';
import { engine } from '../services/engine';

const API_URL = '/api';

const DEFAULT_USAGE: UsageStats = {
  transactions: 0,
  limit: 100,
  aiEnabled: false,
  maxAccounts: 1,
  currentAccounts: 0
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [usage, setUsage] = useState<UsageStats>(DEFAULT_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      engine.setToken(token);
      refreshUsage();
    } else {
      engine.setToken(null);
      setIsLoading(false);
    }
  }, [token]);

  const refreshUsage = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/auth/me`);
      setUser(res.data.user);
      setUsage(res.data.usage);
    } catch (e: any) {
      if (e.response && e.response.status === 401) {
          logout();
      } else {
          console.warn("Backend Unreachable or Error, entering Offline Mode for UI");
          // Only set offline user if one was previously logged in
          if (token) {
             setUser({ id: 'offline_user', email: 'offline@user.com', plan: 'free', createdAt: Date.now() });
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user); // The token useEffect will handle the rest
  };

  const register = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/register`, { email, password: pass });
    localStorage.setItem('token', res.data.token);
    setToken(res.data.token);
    setUser(res.data.user);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    engine.setToken(null);
  };

  const triggerUpgrade = (reason?: string) => {
    const event = new CustomEvent('trigger-upgrade', { detail: { reason } });
    window.dispatchEvent(event);
  };

  return (
    <AuthContext.Provider value={{ 
      user, token, usage, login, register, logout, refreshUsage, triggerUpgrade, isLoading 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
