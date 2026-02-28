import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const userId = localStorage.getItem('userId');
        if (refreshToken && userId) {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken, userId });
          localStorage.setItem('accessToken', data.accessToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        }
      } catch {
        localStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

// ── Auth ──────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (payload: Record<string, unknown>) =>
    api.post('/auth/register', payload),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
};

// ── Interviews ────────────────────────────────────────────────────
export const interviewsApi = {
  getTemplates: () => api.get('/interviews/templates'),
  getTemplate: (id: string) => api.get(`/interviews/templates/${id}`),
  createTemplate: (payload: Record<string, unknown>) =>
    api.post('/interviews/templates', payload),
  getMySessions: () => api.get('/interviews/sessions'),
  startSession: (templateId: string) =>
    api.post('/interviews/sessions/start', { templateId }),
  getNextQuestion: (sessionId: string) =>
    api.get(`/interviews/sessions/${sessionId}/next-question`),
  submitAnswer: (sessionId: string, payload: Record<string, unknown>) =>
    api.post(`/interviews/sessions/${sessionId}/submit-answer`, payload),
  completeSession: (sessionId: string) =>
    api.patch(`/interviews/sessions/${sessionId}/complete`),
  getSessionResult: (sessionId: string) =>
    api.get(`/interviews/sessions/${sessionId}/result`),
};

// ── Reports ───────────────────────────────────────────────────────
export const reportsApi = {
  getReport: (id: string) => api.get(`/reports/${id}`),
  getReportBySession: (sessionId: string) => api.get(`/reports/session/${sessionId}`),
  addNotes: (id: string, notes: string) => api.patch(`/reports/${id}/notes`, { recruiterNotes: notes }),
};

// ── Integrity ─────────────────────────────────────────────────────
export const integrityApi = {
  recordEvent: (sessionId: string, payload: Record<string, unknown>) =>
    api.post(`/interviews/sessions/${sessionId}/integrity`, payload),
};

// ── Payments ──────────────────────────────────────────────────────
export const paymentsApi = {
  createOrder: (plan: string, billing: string) =>
    api.post('/payments/create-order', { plan, billing }),
  verifyPayment: (payload: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    plan: string;
    billing: string;
  }) => api.post('/payments/verify', payload),
};

// ── Panel Interview ───────────────────────────────────────────────
export const panelApi = {
  createSession: (payload: {
    track: string;
    experienceYears: string;
    targetRole: string;
    difficulty: 'Normal' | 'Hard';
  }) => api.post('/panel/sessions', payload),
  listSessions: () => api.get('/panel/sessions'),
  getCurrentQuestion: (sessionId: string) =>
    api.get(`/panel/sessions/${sessionId}/question`),
  submitAnswer: (
    sessionId: string,
    payload: {
      questionId: string;
      answer: string;
      language?: string;
      isFollowUp?: boolean;
    },
  ) => api.post(`/panel/sessions/${sessionId}/answer`, payload),
  getReport: (sessionId: string) =>
    api.get(`/panel/sessions/${sessionId}/report`),
  skipQuestion: (sessionId: string) =>
    api.patch(`/panel/sessions/${sessionId}/skip`),
  abandonInterview: (sessionId: string) =>
    api.patch(`/panel/sessions/${sessionId}/abandon`),
};
