import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '';

const api = axios.create({ baseURL: `${BASE_URL}/api`, timeout: 30000 });

// Attach token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('os_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('os_token');
      localStorage.removeItem('os_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// --- OFFLINE QUEUE ---
const QUEUE_KEY = 'os_offline_queue';
const getQueue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
const saveQueue = q => localStorage.setItem(QUEUE_KEY, JSON.stringify(q));

export const queueRequest = (method, url, data) => {
  const queue = getQueue();
  queue.push({ method, url, data, ts: Date.now() });
  saveQueue(queue);
};

export const syncOfflineQueue = async () => {
  const queue = getQueue();
  if (!queue.length) return 0;
  const failed = [];
  for (const req of queue) {
    try {
      await api({ method: req.method, url: req.url, data: req.data });
    } catch { failed.push(req); }
  }
  saveQueue(failed);
  return queue.length - failed.length;
};

// --- LOCAL CACHE ---
export const cacheSet = (key, data) => {
  try { localStorage.setItem(`os_cache_${key}`, JSON.stringify({ data, ts: Date.now() })); } catch {}
};
export const cacheGet = (key, maxAge = 300000) => {
  try {
    const raw = localStorage.getItem(`os_cache_${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > maxAge) return null;
    return data;
  } catch { return null; }
};

export default api;
