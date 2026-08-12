import api from './api';

export const downloadBackup = () => {
  const base = api.defaults.baseURL || `${window.location.origin}/api`;
  const target = base.includes('://') ? base : `${window.location.protocol}//${window.location.hostname}:5001/api`;
  window.open(`${target}/backup/download?token=${localStorage.getItem('os_token')}`, '_blank');
};

export const getBackupHistory = async () => {
  const res = await api.get('/backup/history');
  return res.data;
};

export const getBackupStatus = async () => {
  const res = await api.get('/backup/status');
  return res.data;
};

export const getBackupSettings = async () => {
  const res = await api.get('/backup/settings');
  return res.data;
};

export const saveBackupSettings = async (settings) => {
  const res = await api.post('/backup/settings', settings);
  return res.data;
};

export const connectGoogleDrive = async () => {
  const res = await api.post('/backup/google-auth');
  return res.data;
};
