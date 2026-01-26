
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
  const [token, setToken] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageStats>(DEFAULT_USAGE);
  const [isLoading, setIsLoading] = useState(true);

  // This useEffect is ONLY for initial page load/rehydration from localStorage.
  // It runs once when the component mounts.
  useEffect(() => {
    const rehydrateSession = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        engine.setToken(storedToken);
        await refreshUsage(); // This fetches user and usage, and handles loading states
      } else {
        setIsLoading(false);
      }
    };
    rehydrateSession();
  }, []); // Empty dependency array ensures this runs only once on mount.

  const refreshUsage = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/auth/me`);
      setUser(res.data.user);
      setUsage(res.data.usage);
    } catch (e: any) {
      if (e.response && e.response.status === 401) {
          // Token is invalid, so clear session.
          logout();
      } else {
          console.warn("Backend Unreachable or Error, entering Offline Mode for UI");
          // Fallback to offline mode only if a token was present
          if (localStorage.getItem('token')) {
             setUser({ id: 'offline_user', email: 'offline@user.com', plan: 'free', createdAt: Date.now() });
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/login`, { email, password: pass });
    const { token: newToken, user: newUser } = res.data;
    
    // Set everything up explicitly to establish the session
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    engine.setToken(newToken);
    
    // Set state to immediately re-render the app in a logged-in state
    setToken(newToken);
    setUser(newUser);
    
    // Fetch the latest usage stats after logging in
    await refreshUsage();
  };

  const register = async (email: string, pass: string) => {
    const res = await axios.post(`${API_URL}/auth/register`, { email, password: pass });
    const { token: newToken, user: newUser } = res.data;
    
    // Set everything up explicitly
    localStorage.setItem('token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    engine.setToken(newToken);

    setToken(newToken);
    setUser(newUser);

    await refreshUsage();
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setUsage(DEFAULT_USAGE); // Reset usage state
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
