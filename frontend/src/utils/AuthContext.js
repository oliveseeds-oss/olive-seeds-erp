import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('os_user')); } catch { return null; }
  });
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('os_token', data.token);
      localStorage.setItem('os_user', JSON.stringify(data.user));
      setUser(data.user);
      return { success: true };
    } catch (e) {
      return { success: false, error: e.response?.data?.error || 'Login failed' };
    } finally { setLoading(false); }
  };

  const logout = () => {
    localStorage.removeItem('os_token');
    localStorage.removeItem('os_user');
    setUser(null);
  };

  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';
  const isViewer = user?.role === 'viewer';
  const canWrite = user?.role !== 'viewer';
  const canModify = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, isAdmin, isEmployee, isViewer, canWrite, canModify }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
