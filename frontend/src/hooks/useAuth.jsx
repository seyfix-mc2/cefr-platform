import { createContext, useContext, useState, useEffect } from 'react';
import { api, setToken, clearToken } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.me()
        .then(data => {
          setUser(data.user);
          setSchool(data.school);
        })
        .catch(() => clearToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(username, password) {
    const data = await api.login(username, password);
    setToken(data.token);
    setUser(data.user);
    setSchool(data.school);
    return data;
  }

  function logout() {
    clearToken();
    setUser(null);
    setSchool(null);
  }

  return (
    <AuthContext.Provider value={{ user, school, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
