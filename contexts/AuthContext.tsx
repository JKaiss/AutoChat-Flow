
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { User, UsageStats, AuthContextType } from '../types';

// Use relative path so Vite proxy handles the connection to backend
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
  
  // Triggers the Upgrade Modal
  const [upgradeReason, setUpgradeReason] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      refreshUsage();
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const refreshUsage = async () => {
    try {
      const res = await axios.get(`${API_URL}/auth/me`);
      setUser(res.data.user);
      setUsage(res.data.usage);
    } catch (e: any) {
      // HANDLE AUTH ERRORS RESILIENTLY
      if (e.response && e.response.status === 401) {
          // Token is invalid/expired -> Logout
          logout();
      } else {
          // 500 or Network Error -> OFFLINE MODE
          // Don't logout the user if the server just crashed temporarily.
          // Keep the token, but maybe flag UI as "Offline" (not implemented in MVP UI yet, but prevents lockout)
          console.warn("Backend Unreachable or Error, entering Offline Mode for UI");
          // If we have a token but no user object, restore from local if possible, or Mock it to keep UI alive
          if (!user && token) {
             // Mock User to allow access to UI
             setUser({ id: 'offline_user', email: 'offline@user.com', plan: 'free', createdAt: Date.now() });
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('token', res.data.token);
  };

  const register = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/register`, { email, password: pass });
    setToken(res.data.token);
    setUser(res.data.user);
    localStorage.setItem('token', res.data.token);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
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
