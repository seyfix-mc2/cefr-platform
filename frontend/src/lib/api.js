const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getSchoolSlug() {
  // 1. Try subdomain (production with custom domain)
  const host = window.location.hostname;
  const baseDomain = import.meta.env.VITE_BASE_DOMAIN || 'yourplatform.com';
  if (host.endsWith(`.${baseDomain}`)) {
    return host.replace(`.${baseDomain}`, '');
  }
  // 2. Use slug saved at login time (works for Render single-domain deployments)
  return localStorage.getItem('school_slug') || 'demo';
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

  // Only treat a 401 as "session expired" when we were actually using a
  // stored session token. A 401 from a fresh login attempt (no token sent)
  // just means wrong credentials -- that must fall through to the normal
  // error handling below so the caller gets a real Error with the server's
  // message, instead of `undefined` from a forced logout-redirect here.
  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('school_slug');
    window.location.href = '/';
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
  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    // Save the JWT token so subsequent requests are authenticated
    if (data?.token) {
      localStorage.setItem('token', data.token);
    }
    // Save slug at login time so all subsequent requests use the right tenant
    if (data?.school?.slug) {
      localStorage.setItem('school_slug', data.school.slug);
    }
    return data;
  },
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

  // Content upload
  previewContent: (text, level) => request('/upload/content/preview', { method: 'POST', body: JSON.stringify({ text, level }) }),
  uploadContent: (text, level, skill, replace) => request('/upload/content', { method: 'POST', body: JSON.stringify({ text, level, skill: skill || 'grammar', replace }) }),
  listUploadedContent: (level) => request(`/upload/content/list${level ? `?level=${level}` : ''}`),
  deleteContent: (level, skill) => request('/upload/content', { method: 'DELETE', body: JSON.stringify({ level, skill }) }),
};

export function setToken(token) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
  localStorage.removeItem('school_slug');
}

api.getUploadedLessons = (level, skill) => request(`/upload/lessons?level=${level}&skill=${skill || 'grammar'}`);
