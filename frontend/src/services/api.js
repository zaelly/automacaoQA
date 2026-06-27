const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5005/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5005/ws';

const TOKEN_KEY = 'qatry_token';
const USER_KEY  = 'qatry_user';

function getToken() { return localStorage.getItem(TOKEN_KEY); }

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(BASE + path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Erro na requisição');
  }
  return res.json();
}

export const api = {
  // ─── Auth ────────────────────────────────────────────────────────────────
  login:         (data) => request('/auth/login',    { method: 'POST', body: data }),
  register:      (data) => request('/auth/register', { method: 'POST', body: data }),
  updateProfile: (data) => request('/auth/profile',  { method: 'PUT',  body: data }),

  setToken: (token) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
  setUser: (user) => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },
  getToken,
  getSavedUser: () => {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); }
    catch { return null; }
  },
  clearSession: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  // ─── Health ──────────────────────────────────────────────────────────────
  health: () => request('/health'),

  // ─── Projects ────────────────────────────────────────────────────────────
  getProjects:     ()           => request('/projects'),
  getProject:      (id)         => request(`/projects/${id}`),
  createProject:   (data)       => request('/projects',    { method: 'POST',   body: data }),
  updateProject:   (id, data)   => request(`/projects/${id}`, { method: 'PUT', body: data }),
  deleteProject:   (id)         => request(`/projects/${id}`, { method: 'DELETE' }),

  // ─── Environments ────────────────────────────────────────────────────────
  getEnvironments:  (projectId) => request(`/environments?project_id=${projectId}`),
  createEnvironment:(data)      => request('/environments',    { method: 'POST', body: data }),
  updateEnvironment:(id, data)  => request(`/environments/${id}`, { method: 'PUT', body: data }),
  deleteEnvironment:(id)        => request(`/environments/${id}`, { method: 'DELETE' }),

  // ─── Test Users ──────────────────────────────────────────────────────────
  getUsers:    (projectId) => request(`/users?project_id=${projectId}`),
  createUser:  (data)      => request('/users',    { method: 'POST', body: data }),
  updateUser:  (id, data)  => request(`/users/${id}`, { method: 'PUT', body: data }),
  deleteUser:  (id)        => request(`/users/${id}`, { method: 'DELETE' }),

  // ─── Flows ───────────────────────────────────────────────────────────────
  getFlows:   (projectId) => request(`/flows?project_id=${projectId}`),
  getFlow:    (id)        => request(`/flows/${id}`),
  createFlow: (data)      => request('/flows',    { method: 'POST', body: data }),
  updateFlow: (id, data)  => request(`/flows/${id}`, { method: 'PUT', body: data }),
  deleteFlow: (id)        => request(`/flows/${id}`, { method: 'DELETE' }),

  // ─── Executions ──────────────────────────────────────────────────────────
  getExecutions:    (projectId, limit = 50) => request(`/executions?project_id=${projectId}&limit=${limit}`),
  getAllExecutions:  (limit = 100)           => request(`/executions?limit=${limit}`),
  getExecution:     (id)                    => request(`/executions/${id}`),
  startExecution:   (data)                  => request('/executions', { method: 'POST', body: data }),
  stopExecution:    (id)                    => request(`/executions/${id}/stop`, { method: 'POST' }),
  deleteExecution:  (id)                    => request(`/executions/${id}`, { method: 'DELETE' }),

  // ─── Reports ─────────────────────────────────────────────────────────────
  getReports:     (projectId) => request(projectId ? `/reports?project_id=${projectId}` : '/reports'),
  getReport:     (id)        => request(`/reports/${id}`),
  reportHtmlUrl: (id)        => `${BASE}/reports/${id}/html`,
  reportPdfUrl:  (id)        => `${BASE}/reports/${id}/pdf`,
  fileUrl:       (relPath)   => `http://localhost:3001/files/${relPath}`,

  // ─── Schedules ───────────────────────────────────────────────────────────
  getSchedules:   (projectId) => request(`/schedules?project_id=${projectId}`),
  createSchedule: (data)      => request('/schedules', { method: 'POST', body: data }),
  toggleSchedule: (id)        => request(`/schedules/${id}/toggle`, { method: 'PUT' }),
  deleteSchedule: (id)        => request(`/schedules/${id}`, { method: 'DELETE' }),
};

// ─── WebSocket subscription ───────────────────────────────────────────────────
export function subscribeToExecution(executionId, handlers = {}) {
  let ws;
  let reconnectTimer;
  let closed = false;

  function connect() {
    ws = new WebSocket(WS_URL);

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.executionId !== executionId && data.executionId !== '') return;
        const handler = handlers[data.type];
        if (handler) handler(data);
        if (handlers.onAny) handlers.onAny(data);
      } catch (_) {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {
      if (!closed) reconnectTimer = setTimeout(connect, 2000);
    };
  }

  connect();

  return () => {
    closed = true;
    clearTimeout(reconnectTimer);
    ws?.close();
  };
}

export default api;
