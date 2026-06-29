/**
 * API client
 * Automatically includes JWT token and school slug header.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getSchoolSlug() {
  // In production: extracted from subdomain
  // In dev: from localStorage or env
  const host = window.location.hostname;
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || 'yourplatform.com';
  if (host.endsWith(`.${baseDomain}`)) {
    return host.replace(`.${baseDomain}`, '');
  }
  return localStorage.getItem('dev_school_slug') || 'demo';
}

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-School-Slug': getSchoolSlug(),
    ...options.headers,
  };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Token expired - clear and redirect
    localStorage.removeItem('token');
    window.location.href = '/login';
    return;
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: (path, body) => request(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),

  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  }),
  me: () => request('/auth/me'),

  // Admin
  getTeachers: () => request('/admin/teachers'),
  createTeacher: (data) => request('/admin/teachers', { method: 'POST', body: JSON.stringify(data) }),
  updateTeacher: (id, data) => request(`/admin/teachers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  getLicense: () => request('/admin/license'),
  updateBranding: (data) => request('/admin/branding', { method: 'PATCH', body: JSON.stringify(data) }),
  getSchoolProgress: () => request('/admin/progress'),

  // Teacher
  getClasses: () => request('/teacher/classes'),
  createClass: (data) => request('/teacher/classes', { method: 'POST', body: JSON.stringify(data) }),
  getStudents: (classId) => request(`/teacher/classes/${classId}/students`),
  createStudent: (classId, data) => request(`/teacher/classes/${classId}/students`, { method: 'POST', body: JSON.stringify(data) }),
  importStudents: (classId, rows) => request(`/teacher/classes/${classId}/students/import`, { method: 'POST', body: JSON.stringify({ rows }) }),
  getStudentProgress: (studentId) => request(`/teacher/students/${studentId}/progress`),

  // Content
  getContent: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/content${qs ? `?${qs}` : ''}`);
  },
  getContentItem: (id) => request(`/content/${id}`),
  getGameTemplates: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/content/games/templates${qs ? `?${qs}` : ''}`);
  },

  // Speaking
  submitSpeakingAttempt: (data) => request('/speaking/attempts', { method: 'POST', body: JSON.stringify(data) }),
  getSpeakingAttempts: () => request('/speaking/attempts'),

  // Assignments
  generateAssignment: (data) => request('/assignments/generate', { method: 'POST', body: JSON.stringify(data) }),
  createAssignment: (data) => request('/assignments', { method: 'POST', body: JSON.stringify(data) }),
  getAssignments: () => request('/assignments'),
  getAssignment: (id) => request(`/assignments/${id}`),
  updateAssignment: (id, data) => request(`/assignments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitAssignment: (id, answers) => request(`/assignments/${id}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
  getAssignmentResults: (id) => request(`/assignments/${id}/results`),

  // Progress
  getProgress: () => request('/progress'),
  getResumePoint: () => request('/progress/resume'),
};

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

// Content upload
api.previewContent = (text, level) => request('/upload/content/preview', { method: 'POST', body: JSON.stringify({ text, level }) });
api.uploadContent = (text, level, replace) => request('/upload/content', { method: 'POST', body: JSON.stringify({ text, level, replace }) });
api.listUploadedContent = (level) => request(`/upload/content/list${level ? `?level=${level}` : ''}`);
api.deleteContent = (level, skill) => request('/upload/content', { method: 'DELETE', body: JSON.stringify({ level, skill }) });
