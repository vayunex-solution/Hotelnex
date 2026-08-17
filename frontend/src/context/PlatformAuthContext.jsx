import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import platformApi from '../services/platformApi.js';

const PlatformAuthContext = createContext(null);

export const PlatformAuthProvider = ({ children }) => {
  const [superAdmin, setSuperAdmin] = useState(null);
  const [loading, setLoading]       = useState(true);
  const navigate = useNavigate();

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const token = localStorage.getItem('platform_token');
      const user  = localStorage.getItem('platform_user');
      if (token && user) setSuperAdmin(JSON.parse(user));
    } catch {
      localStorage.removeItem('platform_token');
      localStorage.removeItem('platform_user');
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await platformApi.post('/auth/login', { email, password });
    const { token, user } = response.data;
    localStorage.setItem('platform_token', token);
    localStorage.setItem('platform_user', JSON.stringify(user));
    setSuperAdmin(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('platform_token');
    localStorage.removeItem('platform_user');
    setSuperAdmin(null);
    navigate('/platform/login');
  }, [navigate]);

  const isAuthenticated = Boolean(superAdmin);

  return (
    <PlatformAuthContext.Provider value={{ superAdmin, loading, login, logout, isAuthenticated }}>
      {children}
    </PlatformAuthContext.Provider>
  );
};

export const usePlatformAuth = () => {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error('usePlatformAuth must be used inside <PlatformAuthProvider>');
  return ctx;
};
