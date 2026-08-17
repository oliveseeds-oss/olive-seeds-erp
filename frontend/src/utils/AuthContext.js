import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

const THEMES = {
  admin: {
    primary: '#1A1A2E',
    badgeBg: '#EEF2FF',
    badgeText: '#3B5BDB',
    badgeLabel: 'ADMIN',
  },
  employee: {
    primary: '#1A1A2E',
    badgeBg: '#ECFDF3',
    badgeText: '#166534',
    badgeLabel: 'EMPLOYEE',
  },
  viewer: {
    primary: '#1A1A2E',
    badgeBg: '#F3E8FF',
    badgeText: '#7E22CE',
    badgeLabel: 'VIEWER',
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('os_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(() => {
    return !!localStorage.getItem('os_token');
  });

  useEffect(() => {
    const token = localStorage.getItem('os_token');
    const userStr = localStorage.getItem('os_user');
    if (!token || !userStr) {
      setLoading(false);
      return;
    }
    // Verify token with backend
    api.get('/auth/me')
      .then(res => {
        setUser(res.data);
        setLoading(false);
      })
      .catch(() => {
        // Token invalid or expired
        localStorage.removeItem('os_token');
        localStorage.removeItem('os_user');
        setUser(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const role = user?.role || 'admin';
    document.body.className = '';
    document.body.classList.add(`theme-${role}`);
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data && res.data.token) {
        const data = res.data;
        localStorage.setItem('os_token', data.token);
        localStorage.setItem('os_user', JSON.stringify(data.user));
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, error: 'Invalid response from server' };
      }
    } catch (e) {
      console.error('Login error:', e);
      return { 
        success: false, 
        error: e.response?.data?.error || e.message || 'Invalid email or password. Please try again.' 
      };
    } finally {
      setLoading(false);
    }
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

export const useTheme = () => {
  const { user } = useAuth();
  const role = user?.role || 'admin';
  return THEMES[role] || THEMES.admin;
};
