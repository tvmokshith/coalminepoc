import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  me: () => api.get('/api/auth/me'),
};

export const minesApi = {
  list: () => api.get('/api/mines'),
  get: (id: string) => api.get(`/api/mines/${id}`),
};

export const kpiApi = {
  definitions: () => api.get('/api/kpi/definitions'),
  current: (mineId?: string) =>
    api.get('/api/kpi/current', { params: mineId ? { mine_id: mineId } : {} }),
  history: (mineId: string, kpiName: string) =>
    api.get('/api/kpi/history', { params: { mine_id: mineId, kpi_name: kpiName } }),
  aggregated: () => api.get('/api/kpi/aggregated'),
};

export const equipmentApi = {
  list: (mineId: string) =>
    api.get('/api/equipment', { params: { mine_id: mineId } }),
  get: (id: string) => api.get(`/api/equipment/${id}`),
  sensors: (id: string) => api.get(`/api/equipment/sensors/${id}`),
  triggerMaintenance: (id: string) =>
    api.patch(`/api/equipment/${id}/maintenance`),
};

export const advisoryApi = {
  list: (mineId?: string) =>
    api.get('/api/advisory', { params: mineId ? { mine_id: mineId } : {} }),
  acknowledge: (id: string) => api.patch(`/api/advisory/${id}/acknowledge`),
  resolve: (id: string) => api.patch(`/api/advisory/${id}/resolve`),
};

export const alertsApi = {
  list: (mineId?: string) =>
    api.get('/api/alerts', { params: mineId ? { mine_id: mineId } : {} }),
  acknowledge: (id: string) => api.patch(`/api/alerts/${id}/acknowledge`),
};

export const subsystemsApi = {
  logistics: (mineId?: string) =>
    api.get('/api/subsystems/logistics', { params: mineId ? { mine_id: mineId } : {} }),
  hr: (mineId?: string) =>
    api.get('/api/subsystems/hr', { params: mineId ? { mine_id: mineId } : {} }),
  finance: (mineId?: string) =>
    api.get('/api/subsystems/finance', { params: mineId ? { mine_id: mineId } : {} }),
  esg: (mineId?: string) =>
    api.get('/api/subsystems/esg', { params: mineId ? { mine_id: mineId } : {} }),
  ehs: (mineId?: string) =>
    api.get('/api/subsystems/ehs', { params: mineId ? { mine_id: mineId } : {} }),
};

export const workOrdersApi = {
  list: () => api.get('/api/work-orders'),
  create: (mineId: string, equipmentId: string, description: string, priority: string) =>
    api.post('/api/work-orders', null, {
      params: { mine_id: mineId, equipment_id: equipmentId, description, priority },
    }),
};

export const WS_URL = API_BASE.replace('http', 'ws') + '/ws';

export default api;
