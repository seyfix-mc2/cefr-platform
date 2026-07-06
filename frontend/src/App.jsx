import ContentLibrary from "./components/ContentLibrary.jsx";
import { api } from "./lib/api.js";
import { useState, useEffect, useMemo, createContext, useContext } from "react";

// ─────────────────────────────────────────────────────────────
// MOCK API (simulates backend for standalone demo)
// ─────────────────────────────────────────────────────────────

const MOCK_DB = {
  school: {
    name: "Demo Language School",
    slug: "demo",
    primary_color: "#4F46E5",
    logo_url: null,
    license: {
      expiry: "2027-06-30",
      seats_teachers: { used: 3, total: 10 },
      seats_students: { used: 47, total: 200 },
      unlocked_modules: ["grammar", "vocabulary", "speaking", "games"],
    },
  },
  users: {
    admin: { id: "u1", role: "admin", username: "admin", display_name: "Dr. Chen" },
    teacher1: { id: "u2", role: "teacher", username: "teacher1", display_name: "Ms. Johnson" },
    alice: { id: "u3", role: "student", username: "alice", display_name: "Alice", cefr_level: "A2", class_id: "c1" },
  },
  teachers: [
    { id: "u2", username: "teacher1", display_name: "Ms. Johnson", is_active: true, class_count: 2, student_count: 24, last_login_at: "2026-06-28T09:00:00Z" },
    { id: "u4", username: "teacher2", display_name: "Mr. Okafor", is_active: true, class_count: 1, student_count: 16, last_login_at: "2026-06-27T14:30:00Z" },
    { id: "u5", username: "teacher3", display_name: "Ms. Rivera", is_active: false, class_count: 0, student_count: 0, last_login_at: "2026-05-01T11:00:00Z" },
  ],
  classes: [
    { id: "c1", name: "A2 Morning Class", cefr_level: "A2", student_count: 12, teacher_id: "u2" },
    { id: "c2", name: "B1 Evening Class", cefr_level: "B1", student_count: 9, teacher_id: "u2" },
    { id: "c3", name: "A1 Beginners", cefr_level: "A1", student_count: 7, teacher_id: "u4" },
  ],
  students: [
    { id: "u3", username: "alice", display_name: "Alice", cefr_level: "A2", avg_score: 78, exercises_completed: 34, last_login_at: "2026-06-29T08:00:00Z" },
    { id: "u6", username: "bob", display_name: "Bob", cefr_level: "A2", avg_score: 65, exercises_completed: 22, last_login_at: "2026-06-28T16:00:00Z" },
    { id: "u7", username: "carla", display_name: "Carla", cefr_level: "A2", avg_score: 91, exercises_completed: 51, last_login_at: "2026-06-29T09:30:00Z" },
    { id: "u8", username: "david", display_name: "David", cefr_level: "A2", avg_score: 54, exercises_completed: 18, last_login_at: "2026-06-26T10:00:00Z" },
    { id: "u9", username: "elena", display_name: "Elena", cefr_level: "A2", avg_score: 83, exercises_completed: 44, last_login_at: "2026-06-29T07:45:00Z" },
  ],
  content: [
    {
      id: "ci1", level: "A2", skill: "grammar", type: "multiple_choice",
      title: "Present Simple vs Continuous",
      body: {
        instructions: "Choose the correct verb form.",
        items: [
          { id: 1, prompt: "She _____ (work) in London every day.", options: ["works", "is working", "worked", "has worked"], correct: 0, explanation: "We use present simple for routines and habits." },
          { id: 2, prompt: "Look! He _____ (run) very fast.", options: ["runs", "is running", "ran", "run"], correct: 1, explanation: "We use present continuous for actions happening now." },
          { id: 3, prompt: "They _____ (study) for their exam right now.", options: ["study", "studied", "are studying", "have studied"], correct: 2, explanation: "Right now signals present continuous." },
        ]
      }
    },
    {
      id: "ci2", level: "A2", skill: "vocabulary", type: "matching",
      title: "Daily Routines Vocabulary",
      body: {
        instructions: "Match each word with its definition.",
        items: [
          { id: 1, term: "commute", definition: "Travel regularly between home and work" },
          { id: 2, term: "errand", definition: "A short trip to do a specific task" },
          { id: 3, term: "routine", definition: "A regular sequence of activities" },
          { id: 4, term: "schedule", definition: "A plan showing when events will happen" },
        ]
      }
    },
    {
      id: "ci3", level: "A2", skill: "grammar", type: "fill_blank",
      title: "Prepositions of Time",
      body: {
        instructions: "Fill in the blank with the correct preposition: in, on, or at.",
        items: [
          { id: 1, prompt: "The meeting is _____ Monday morning.", answer: "on", explanation: 'Use "on" with days of the week.' },
          { id: 2, prompt: "We eat dinner _____ 7 pm.", answer: "at", explanation: 'Use "at" with specific times.' },
          { id: 3, prompt: "She was born _____ July.", answer: "in", explanation: 'Use "in" with months.' },
        ]
      }
    },
    {
      id: "ci4", level: "A2", skill: "speaking", type: "dictation",
      title: "Daily Life Dictation 1",
      body: {
        instructions: "Listen to the sentence and type what you hear.",
        sentences: [
          { id: 1, text: "She goes to work by bus every morning." },
          { id: 2, text: "They are having lunch in the park right now." },
        ]
      }
    },
    {
      id: "ci5", level: "A2", skill: "speaking", type: "read_aloud",
      title: "Read Aloud: Introductions",
      body: {
        instructions: "Read the following passage aloud clearly and naturally.",
        passage: "My name is Sarah and I am a teacher. I work at a primary school in the city centre. Every morning I wake up at seven o'clock and have breakfast before I leave the house.",
        focus_words: ["teacher", "breakfast", "centre", "enjoy", "children"],
      }
    },
  ],
  assignments: [
    {
      id: "a1", title: "Prepositions Quiz", type: "quiz", level: "A2", skill: "grammar",
      due_date: "2026-07-05", is_published: true, submission_count: 3,
      generated_content: {
        instructions: "Choose the correct preposition for each sentence.",
        questions: [
          { id: 1, type: "multiple_choice", prompt: "The concert starts _____ 8 o'clock.", options: ["in", "on", "at", "by"], correct: 2 },
          { id: 2, type: "multiple_choice", prompt: "She was born _____ March.", options: ["in", "on", "at", "by"], correct: 0 },
          { id: 3, type: "multiple_choice", prompt: "We have class _____ Monday.", options: ["in", "on", "at", "by"], correct: 1 },
        ],
        answer_key: { 1: "2", 2: "0", 3: "1" }
      }
    },
  ],
  progress: [
    { skill: "grammar", level: "A2", exercises_completed: 18, exercises_correct: 14, avg_score: 78 },
    { skill: "vocabulary", level: "A2", exercises_completed: 12, exercises_correct: 10, avg_score: 83 },
    { skill: "speaking", level: "A2", exercises_completed: 4, exercises_correct: 3, avg_score: 71 },
  ],
};

// Simulated AI response for speaking
async function mockAIScore(type, text) {
  await new Promise(r => setTimeout(r, 1800)); // simulate latency
  const score = Math.floor(Math.random() * 30) + 65;
  const feedbacks = {
    dictation: `Your transcription scored ${score}/100. ${score > 75 ? "Good accuracy overall! Minor spelling differences noted." : "Check your spelling of key words. Listen again carefully for small words like articles and prepositions."}`,
    read_aloud: `Fluency score: ${score}/100. ${score > 75 ? "Good pacing and clear pronunciation of most words." : "Focus on stress patterns and try to read in natural phrases rather than word by word."}`,
    picture_description: `Description scored ${score}/100. ${score > 75 ? "Good vocabulary range and relevant details. Grammar is mostly accurate." : "Try to use more specific vocabulary and vary your sentence structures."}`,
  };
  return {
    score,
    feedback: feedbacks[type] || "Good attempt! Keep practising.",
    strengths: score > 75 ? ["Clear structure", "Good vocabulary"] : ["Attempted all parts"],
    improvements: score > 75 ? ["Work on a few pronunciation details"] : ["Review grammar rules", "Expand vocabulary"],
  };
}

// ─────────────────────────────────────────────────────────────
// AUTH CONTEXT
// ─────────────────────────────────────────────────────────────
const AuthCtx = createContext(null);

function useAuth() { return useContext(AuthCtx); }

// ─────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────

function Badge({ children, color = "indigo" }) {
  const colors = {
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-700",
    red: "bg-red-100 text-red-700",
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-100 text-blue-700",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>{children}</span>;
}

function ScorePill({ score }) {
  if (score == null) return <Badge color="gray">—</Badge>;
  if (score >= 80) return <Badge color="green">{score}%</Badge>;
  if (score >= 60) return <Badge color="yellow">{score}%</Badge>;
  return <Badge color="red">{score}%</Badge>;
}

function Card({ children, className = "", ...rest }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`} {...rest}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", size = "md", disabled = false, type = "button", className = "" }) {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-indigo-600 hover:bg-indigo-50",
  };
  const sizes = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 font-medium rounded-lg transition-colors ${variants[variant]} ${sizes[size]} disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <input
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        {...props}
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>}
      <select
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        {...props}
      >
        {children}
      </select>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function EmptyState({ icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">{description}</p>
      {action}
    </div>
  );
}

function ProgressBar({ value, max = 100, color = "indigo" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colors = { indigo: "bg-indigo-500", green: "bg-green-500", yellow: "bg-yellow-500" };
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`h-2 rounded-full transition-all ${colors[color]}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CEFRBadge({ level }) {
  const colors = { A1: "bg-emerald-100 text-emerald-700", A2: "bg-teal-100 text-teal-700", B1: "bg-blue-100 text-blue-700", B2: "bg-purple-100 text-purple-700" };
  return <span className={`px-2 py-0.5 rounded text-xs font-bold ${colors[level] || "bg-gray-100 text-gray-600"}`}>{level}</span>;
}

function Modal({ open, onClose, title, children, size = "md" }) {
  if (!open) return null;
  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// LOGIN PAGE
// ─────────────────────────────────────────────────────────────

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(username, password);
      // api.login() already saves token + school_slug to localStorage
      onLogin(data.user, data.school);
    } catch (err) {
      setError(err.message || "Invalid username or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-2xl">🎓</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Language Learning Platform</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
          <p className="text-xs text-gray-300 mt-1">v2.3</p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" autoComplete="username" />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full justify-center">
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </Card>

        <div className="mt-6 text-xs text-gray-500 text-center space-y-1">
          <p className="font-medium text-gray-600">Demo accounts</p>
          <p>admin / admin123 · teacher1 / teacher123 · alice / student123</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SHARED NAV + LAYOUT
// ─────────────────────────────────────────────────────────────

function Layout({ children, nav }) {
  const { user, school, logout } = useAuth();
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-lg">🎓</div>
            <div>
              <div className="text-sm font-semibold text-gray-900 leading-tight">{school?.name}</div>
              <div className="text-xs text-gray-400 capitalize">{user?.role}</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {nav.map(item => (
            <NavItem key={item.id} item={item} />
          ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">
              {user?.display_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{user?.display_name}</div>
              <div className="text-xs text-gray-400">{user?.username}</div>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={logout} className="w-full justify-center text-gray-500">
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

function NavItem({ item }) {
  const [active, setActive] = useState(false);
  return (
    <button
      onClick={() => { item.onClick?.(); }}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left ${item.active ? "bg-indigo-50 text-indigo-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}
    >
      <span className="text-base">{item.icon}</span>
      {item.label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────

function AdminDashboard() {
  const [page, setPage] = useState("overview");
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [teachers, setTeachers] = useState(MOCK_DB.teachers);
  const [newTeacher, setNewTeacher] = useState({ username: "", password: "", display_name: "" });
  const [addError, setAddError] = useState("");

  const nav = [
    { id: "overview", label: "Overview", icon: "📊", active: page === "overview", onClick: () => setPage("overview") },
    { id: "teachers", label: "Teachers", icon: "👩‍🏫", active: page === "teachers", onClick: () => setPage("teachers") },
    { id: "progress", label: "School Progress", icon: "📈", active: page === "progress", onClick: () => setPage("progress") },
    { id: "branding", label: "Branding", icon: "🎨", active: page === "branding", onClick: () => setPage("branding") },
    { id: "library", label: "Content Library", icon: "📚", active: page === "library", onClick: () => setPage("library") },
  ];

  function addTeacher() {
    if (!newTeacher.username || !newTeacher.password) { setAddError("Username and password are required."); return; }
    setTeachers(t => [...t, { id: `u${Date.now()}`, ...newTeacher, is_active: true, class_count: 0, student_count: 0, last_login_at: null }]);
    setShowAddTeacher(false);
    setNewTeacher({ username: "", password: "", display_name: "" });
    setAddError("");
  }

  function toggleTeacher(id) {
    setTeachers(t => t.map(x => x.id === id ? { ...x, is_active: !x.is_active } : x));
  }

  return (
    <Layout nav={nav}>
      {page === "overview" && (
        <div className="p-8 max-w-5xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">School Overview</h1>
          <p className="text-gray-500 mb-8">License status and platform summary</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <Card className="p-6">
              <div className="text-sm text-gray-500 mb-1">License Expiry</div>
              <div className="text-2xl font-bold text-gray-900">June 30, 2027</div>
              <Badge color="green" className="mt-2">Active</Badge>
            </Card>
            <Card className="p-6">
              <div className="text-sm text-gray-500 mb-1">Modules Unlocked</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {MOCK_DB.school.license.unlocked_modules.map(m => (
                  <Badge key={m} color="indigo">{m}</Badge>
                ))}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">Teacher Seats</div>
                <span className="text-sm text-gray-500">{MOCK_DB.school.license.seats_teachers.used} / {MOCK_DB.school.license.seats_teachers.total}</span>
              </div>
              <ProgressBar value={MOCK_DB.school.license.seats_teachers.used} max={MOCK_DB.school.license.seats_teachers.total} />
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">Student Seats</div>
                <span className="text-sm text-gray-500">{MOCK_DB.school.license.seats_students.used} / {MOCK_DB.school.license.seats_students.total}</span>
              </div>
              <ProgressBar value={MOCK_DB.school.license.seats_students.used} max={MOCK_DB.school.license.seats_students.total} color="green" />
            </Card>
          </div>
        </div>
      )}

      {page === "teachers" && (
        <div className="p-8 max-w-4xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Teachers</h1>
              <p className="text-gray-500 mt-1">{teachers.filter(t => t.is_active).length} active · {MOCK_DB.school.license.seats_teachers.total} seats total</p>
            </div>
            <Button onClick={() => setShowAddTeacher(true)}>+ Add Teacher</Button>
          </div>

          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Username</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Classes</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Students</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{t.display_name}</td>
                    <td className="px-6 py-4 text-gray-500">{t.username}</td>
                    <td className="px-6 py-4 text-gray-700">{t.class_count}</td>
                    <td className="px-6 py-4 text-gray-700">{t.student_count}</td>
                    <td className="px-6 py-4">
                      <Badge color={t.is_active ? "green" : "gray"}>{t.is_active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      <Button variant="ghost" size="sm" onClick={() => toggleTeacher(t.id)}>
                        {t.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Modal open={showAddTeacher} onClose={() => setShowAddTeacher(false)} title="Add Teacher Account">
            <div className="space-y-4">
              <Input label="Full name" value={newTeacher.display_name} onChange={e => setNewTeacher(t => ({ ...t, display_name: e.target.value }))} placeholder="Ms. Smith" />
              <Input label="Username" value={newTeacher.username} onChange={e => setNewTeacher(t => ({ ...t, username: e.target.value.toLowerCase() }))} placeholder="msmith" />
              <Input label="Initial password" type="password" value={newTeacher.password} onChange={e => setNewTeacher(t => ({ ...t, password: e.target.value }))} placeholder="Minimum 8 characters" />
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex gap-3 pt-2">
                <Button onClick={addTeacher} className="flex-1 justify-center">Create account</Button>
                <Button variant="secondary" onClick={() => setShowAddTeacher(false)} className="flex-1 justify-center">Cancel</Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {page === "progress" && (
        <div className="p-8 max-w-4xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">School-wide Progress</h1>
          <p className="text-gray-500 mb-8">Aggregate across all classes</p>
          <Card>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Level</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Skill</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Students</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Avg Score</th>
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Exercises Done</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { level: "A1", skill: "grammar", students: 7, avg_score: 72, total_exercises: 95 },
                  { level: "A2", skill: "grammar", students: 21, avg_score: 76, total_exercises: 312 },
                  { level: "A2", skill: "vocabulary", students: 21, avg_score: 81, total_exercises: 278 },
                  { level: "A2", skill: "speaking", students: 18, avg_score: 68, total_exercises: 94 },
                  { level: "B1", skill: "grammar", students: 9, avg_score: 74, total_exercises: 187 },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4"><CEFRBadge level={row.level} /></td>
                    <td className="px-6 py-4 text-gray-700 capitalize">{row.skill}</td>
                    <td className="px-6 py-4 text-gray-700">{row.students}</td>
                    <td className="px-6 py-4"><ScorePill score={row.avg_score} /></td>
                    <td className="px-6 py-4 text-gray-700">{row.total_exercises}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {page === "library" && <ContentLibrary />}

      {page === "branding" && (
        <div className="p-8 max-w-xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">School Branding</h1>
          <p className="text-gray-500 mb-8">Customize how the platform looks for your school</p>
          <Card className="p-6 space-y-5">
            <Input label="School display name" defaultValue="Greenfield Language Academy" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand color</label>
              <div className="flex items-center gap-3">
                <input type="color" defaultValue="#4F46E5" className="w-10 h-10 rounded border cursor-pointer" />
                <span className="text-sm text-gray-500">Used in headers and accent elements</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Logo</label>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                <div className="text-gray-400 text-sm">Upload logo (PNG or SVG recommended)</div>
                <Button variant="secondary" size="sm" className="mt-3">Choose file</Button>
              </div>
            </div>
            <Button>Save changes</Button>
          </Card>
        </div>
      )}
    </Layout>
  );
}

// ─────────────────────────────────────────────────────────────
// TEACHER DASHBOARD
// ─────────────────────────────────────────────────────────────

function TeacherDashboard() {
  const [page, setPage] = useState("roster");
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [students, setStudents] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [newStudent, setNewStudent] = useState({ username: "", password: "", display_name: "", cefr_level: "A1" });
  const [addError, setAddError] = useState("");
  const [adding, setAdding] = useState(false);

  // Load classes on mount
  useEffect(() => {
    api.getClasses()
      .then(data => {
        setClasses(data.classes || []);
        if (data.classes?.length > 0) setSelectedClassId(data.classes[0].id);
      })
      .catch(err => console.error('[classes]', err))
      .finally(() => setLoadingClasses(false));
  }, []);

  // Load students whenever selected class changes
  useEffect(() => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    api.getStudents(selectedClassId)
      .then(data => setStudents(data.students || []))
      .catch(err => console.error('[students]', err))
      .finally(() => setLoadingStudents(false));
  }, [selectedClassId]);

  async function refreshStudents() {
    if (!selectedClassId) return;
    const data = await api.getStudents(selectedClassId);
    setStudents(data.students || []);
  }

  async function handleAddStudent() {
    setAddError("");
    if (!newStudent.username || !newStudent.password) {
      setAddError("Username and password are required.");
      return;
    }
    setAdding(true);
    try {
      await api.createStudent(selectedClassId, newStudent);
      await refreshStudents();
      setShowAddStudent(false);
      setNewStudent({ username: "", password: "", display_name: "", cefr_level: "A1" });
    } catch (err) {
      setAddError(err.message || "Failed to create student.");
    } finally {
      setAdding(false);
    }
  }

  const nav = [
    { id: "roster", label: "Class Roster", icon: "👥", active: page === "roster", onClick: () => { setPage("roster"); setSelectedStudent(null); } },
    { id: "assignments", label: "Assignments", icon: "📝", active: page === "assignments", onClick: () => setPage("assignments") },
  ];

  const avgScore = students.length
    ? Math.round(students.reduce((s, st) => s + (Number(st.avg_score) || 0), 0) / students.length)
    : 0;
  const activeThisWeek = students.filter(s => {
    if (!s.last_login_at) return false;
    const days = (Date.now() - new Date(s.last_login_at).getTime()) / 86400000;
    return days <= 7;
  }).length;

  return (
    <Layout nav={nav}>
      {page === "roster" && !selectedStudent && (
        <div className="p-8 max-w-5xl">
          <div className="flex items-center gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class Roster</h1>
              <p className="text-gray-500 mt-1">Manage your students and track progress</p>
            </div>
            <div className="ml-auto flex gap-3">
              {loadingClasses ? (
                <span className="text-sm text-gray-400">Loading classes…</span>
              ) : classes.length === 0 ? (
                <span className="text-sm text-gray-400">No classes yet</span>
              ) : (
                <select
                  value={selectedClassId || ""}
                  onChange={e => setSelectedClassId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {classes.length === 0 && !loadingClasses && (
            <EmptyState icon="🏫" title="No classes yet" description="Create a class first before adding students." />
          )}

          {selectedClassId && (
            <>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="p-5">
                  <div className="text-2xl font-bold text-gray-900">{students.length}</div>
                  <div className="text-sm text-gray-500 mt-0.5">Students enrolled</div>
                </Card>
                <Card className="p-5">
                  <div className="text-2xl font-bold text-gray-900">{avgScore}%</div>
                  <div className="text-sm text-gray-500 mt-0.5">Class avg score</div>
                </Card>
                <Card className="p-5">
                  <div className="text-2xl font-bold text-gray-900">{activeThisWeek}/{students.length}</div>
                  <div className="text-sm text-gray-500 mt-0.5">Active this week</div>
                </Card>
              </div>

              <Card>
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Students</h2>
                  <Button size="sm" variant="secondary" onClick={() => setShowAddStudent(true)}>+ Add student</Button>
                </div>

                {loadingStudents ? (
                  <div className="flex justify-center py-10">
                    <div className="w-6 h-6 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : students.length === 0 ? (
                  <EmptyState icon="🧑‍🎓" title="No students yet" description="Add your first student to this class." action={<Button onClick={() => setShowAddStudent(true)}>+ Add student</Button>} />
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-6 py-3 font-medium text-gray-500">Student</th>
                        <th className="text-left px-6 py-3 font-medium text-gray-500">Level</th>
                        <th className="text-left px-6 py-3 font-medium text-gray-500">Exercises</th>
                        <th className="text-left px-6 py-3 font-medium text-gray-500">Avg Score</th>
                        <th className="text-left px-6 py-3 font-medium text-gray-500">Last Active</th>
                        <th className="px-6 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(s => (
                        <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-semibold text-sm">{s.display_name?.[0] || s.username[0]}</div>
                              <div>
                                <div className="font-medium text-gray-900">{s.display_name || s.username}</div>
                                <div className="text-xs text-gray-400">@{s.username}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">{s.cefr_level ? <CEFRBadge level={s.cefr_level} /> : <span className="text-gray-300 text-xs">—</span>}</td>
                          <td className="px-6 py-4 text-gray-700">{s.exercises_completed || 0}</td>
                          <td className="px-6 py-4"><ScorePill score={s.avg_score ? Math.round(s.avg_score) : null} /></td>
                          <td className="px-6 py-4 text-gray-500 text-xs">{s.last_login_at ? new Date(s.last_login_at).toLocaleDateString() : "Never"}</td>
                          <td className="px-6 py-4">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(s)}>View →</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
            </>
          )}

          <Modal open={showAddStudent} onClose={() => setShowAddStudent(false)} title="Add Student">
            <div className="space-y-4">
              <Input label="Full name" value={newStudent.display_name} onChange={e => setNewStudent(s => ({ ...s, display_name: e.target.value }))} placeholder="e.g. Maria Santos" />
              <Input label="Username" value={newStudent.username} onChange={e => setNewStudent(s => ({ ...s, username: e.target.value.toLowerCase().trim() }))} placeholder="e.g. maria" />
              <Input label="Initial password" type="password" value={newStudent.password} onChange={e => setNewStudent(s => ({ ...s, password: e.target.value }))} placeholder="Minimum 8 characters" />
              <Select label="CEFR level" value={newStudent.cefr_level} onChange={e => setNewStudent(s => ({ ...s, cefr_level: e.target.value }))}>
                {["A1", "A2", "B1", "B2"].map(l => <option key={l} value={l}>{l}</option>)}
              </Select>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleAddStudent} disabled={adding} className="flex-1 justify-center">
                  {adding ? "Creating…" : "Create account"}
                </Button>
                <Button variant="secondary" onClick={() => setShowAddStudent(false)} className="flex-1 justify-center">Cancel</Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {page === "roster" && selectedStudent && (
        <StudentDetailView student={selectedStudent} onBack={() => setSelectedStudent(null)} />
      )}

      {page === "assignments" && (
        <AssignmentManagerView onGenerate={() => setShowGenerateModal(true)} />
      )}

      <GenerateAssignmentModal open={showGenerateModal} onClose={() => setShowGenerateModal(false)} />
    </Layout>
  );
}

function StudentDetailView({ student, onBack }) {
  const progress = MOCK_DB.progress;

  return (
    <div className="p-8 max-w-4xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        ← Back to roster
      </button>
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-700 font-bold text-2xl">{student.display_name[0]}</div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{student.display_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-500 text-sm">@{student.username}</span>
            <CEFRBadge level={student.cefr_level} />
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold text-gray-900">{student.avg_score}%</div>
          <div className="text-sm text-gray-500">Overall average</div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Progress by Skill</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {progress.map(p => (
          <Card key={`${p.skill}-${p.level}`} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-gray-700 capitalize">{p.skill}</div>
              <ScorePill score={p.avg_score} />
            </div>
            <ProgressBar value={p.avg_score} color={p.avg_score >= 80 ? "green" : p.avg_score >= 60 ? "indigo" : "yellow"} />
            <div className="text-xs text-gray-400 mt-2">{p.exercises_completed} exercises completed</div>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Speaking Attempts</h2>
      <Card>
        {[
          { type: "read_aloud", title: "Read Aloud: Introductions", score: 82, date: "2026-06-29" },
          { type: "dictation", title: "Daily Life Dictation 1", score: 71, date: "2026-06-27" },
          { type: "picture_description", title: "Describe the Market Scene", score: 68, date: "2026-06-25" },
        ].map((a, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-50 last:border-0">
            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-lg">
              {a.type === "read_aloud" ? "🎤" : a.type === "dictation" ? "✍️" : "🖼️"}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-900">{a.title}</div>
              <div className="text-xs text-gray-400 capitalize">{a.type.replace("_", " ")} · {a.date}</div>
            </div>
            <ScorePill score={a.score} />
          </div>
        ))}
      </Card>
    </div>
  );
}

function AssignmentManagerView({ onGenerate }) {
  const [assignments, setAssignments] = useState(MOCK_DB.assignments);

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-500 mt-1">Generate, review, and assign work to your classes</p>
        </div>
        <Button onClick={onGenerate}>✨ Generate with AI</Button>
      </div>

      <div className="space-y-4">
        {assignments.map(a => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{a.type === "quiz" ? "📝" : a.type === "exam" ? "📋" : "📚"}</div>
                <div>
                  <div className="font-semibold text-gray-900">{a.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <CEFRBadge level={a.level} />
                    <span className="text-xs text-gray-500 capitalize">{a.skill}</span>
                    <span className="text-xs text-gray-400">Due {a.due_date}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500">{a.submission_count} submitted</div>
                <Badge color={a.is_published ? "green" : "yellow"}>{a.is_published ? "Published" : "Draft"}</Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {assignments.length === 0 && (
        <EmptyState
          icon="📝"
          title="No assignments yet"
          description="Use AI to generate a quiz, homework, or exam. You'll review it before students see it."
          action={<Button onClick={onGenerate}>Generate your first assignment</Button>}
        />
      )}
    </div>
  );
}

function GenerateAssignmentModal({ open, onClose }) {
  const [step, setStep] = useState("form"); // form | generating | review
  const [form, setForm] = useState({ type: "quiz", level: "A2", skill: "grammar", topic: "", question_count: "8" });
  const [draft, setDraft] = useState(null);

  async function generate() {
    if (!form.topic) return;
    setStep("generating");
    await new Promise(r => setTimeout(r, 2500));
    setDraft({
      title: `${form.level} ${form.skill.charAt(0).toUpperCase() + form.skill.slice(1)} Quiz: ${form.topic}`,
      instructions: `Choose the correct answer for each question about ${form.topic}.`,
      questions: [
        { id: 1, type: "multiple_choice", prompt: `Which sentence uses correct grammar related to ${form.topic}?`, options: ["Option A (correct)", "Option B", "Option C", "Option D"], correct: 0 },
        { id: 2, type: "fill_blank", prompt: `Fill in the blank: She _____ to school every day.`, answer: "goes" },
        { id: 3, type: "multiple_choice", prompt: "Another example question about the topic.", options: ["Answer A", "Answer B (correct)", "Answer C", "Answer D"], correct: 1 },
      ],
    });
    setStep("review");
  }

  function reset() { setStep("form"); setDraft(null); }

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Generate Assignment with AI" size="lg">
      {step === "form" && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600 bg-indigo-50 rounded-lg p-3">
            You'll review and edit the generated content before students see it.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="quiz">Quiz</option>
              <option value="homework">Homework</option>
              <option value="exam">Exam</option>
            </Select>
            <Select label="Level" value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}>
              {["A1","A2","B1","B2"].map(l => <option key={l} value={l}>{l}</option>)}
            </Select>
            <Select label="Skill" value={form.skill} onChange={e => setForm(f => ({ ...f, skill: e.target.value }))}>
              <option value="grammar">Grammar</option>
              <option value="vocabulary">Vocabulary</option>
            </Select>
          </div>
          <Input label="Topic / keywords" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} placeholder="e.g. past tense, daily routines, prepositions of place" />
          <Select label="Number of questions" value={form.question_count} onChange={e => setForm(f => ({ ...f, question_count: e.target.value }))}>
            {[5,8,10,15].map(n => <option key={n} value={n}>{n} questions</option>)}
          </Select>
          <Button onClick={generate} disabled={!form.topic} className="w-full justify-center">
            ✨ Generate with AI
          </Button>
        </div>
      )}

      {step === "generating" && (
        <div className="py-8 text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Claude is writing your assignment…</p>
          <p className="text-sm text-gray-400 mt-1">Calibrating to {form.level} level · Referencing your content bank</p>
        </div>
      )}

      {step === "review" && draft && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            ✏️ Review and edit this content before assigning to students.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" defaultValue={draft.title} />
          </div>
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">Questions ({draft.questions.length})</div>
            {draft.questions.map((q, i) => (
              <div key={q.id} className="border border-gray-200 rounded-lg p-4">
                <div className="text-xs text-gray-400 mb-2">Q{i + 1} · {q.type.replace("_", " ")}</div>
                <div className="text-sm text-gray-900 font-medium">{q.prompt}</div>
                {q.options && (
                  <div className="mt-2 space-y-1">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`text-xs px-2 py-1 rounded ${j === q.correct ? "bg-green-50 text-green-700 font-medium" : "text-gray-500"}`}>
                        {String.fromCharCode(65 + j)}. {opt}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 pt-2">
            <Button className="flex-1 justify-center">Assign to class</Button>
            <Button variant="secondary" onClick={reset}>Regenerate</Button>
            <Button variant="secondary" onClick={() => { onClose(); reset(); }}>Save draft</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────
// STUDENT DASHBOARD
// ─────────────────────────────────────────────────────────────

function StudentDashboard() {
  const { user } = useAuth();
  const [page, setPage] = useState("home");
  const [activeContent, setActiveContent] = useState(null);

  const nav = [
    { id: "home", label: "Home", icon: "🏠", active: page === "home", onClick: () => { setPage("home"); setActiveContent(null); } },
    { id: "grammar", label: "Grammar", icon: "📖", active: page === "grammar", onClick: () => { setPage("grammar"); setActiveContent(null); } },
    { id: "vocabulary", label: "Vocabulary", icon: "🔤", active: page === "vocabulary", onClick: () => { setPage("vocabulary"); setActiveContent(null); } },
    { id: "speaking", label: "Speaking", icon: "🎤", active: page === "speaking", onClick: () => { setPage("speaking"); setActiveContent(null); } },
    { id: "games", label: "Games", icon: "🎮", active: page === "games", onClick: () => { setPage("games"); setActiveContent(null); } },
    { id: "assignments", label: "Assignments", icon: "📋", active: page === "assignments", onClick: () => { setPage("assignments"); setActiveContent(null); } },
  ];

  function openContent(item) {
    setActiveContent(item);
  }

  if (activeContent) {
    return (
      <Layout nav={nav}>
        <ExerciseView item={activeContent} onBack={() => setActiveContent(null)} />
      </Layout>
    );
  }

  return (
    <Layout nav={nav}>
      {page === "home" && <StudentHome user={user} onStart={openContent} />}
      {page === "grammar" && <ContentList skill="grammar" level={user?.cefr_level || "A2"} onSelect={openContent} />}
      {page === "vocabulary" && <ContentList skill="vocabulary" level={user?.cefr_level || "A2"} onSelect={openContent} />}
      {page === "speaking" && <ContentList skill="speaking" level={user?.cefr_level || "A2"} onSelect={openContent} />}
      {page === "games" && <GamesView />}
      {page === "assignments" && <StudentAssignmentsView onSelect={openContent} />}
    </Layout>
  );
}

function StudentHome({ user, onStart }) {
  const progress = MOCK_DB.progress;
  const resumeItem = MOCK_DB.content.find(c => c.skill === "grammar");

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {user?.display_name} 👋</h1>
        <p className="text-gray-500 mt-1">Keep up the great work on your English journey.</p>
      </div>

      {resumeItem && (
        <Card className="p-6 mb-6 border-indigo-200 bg-indigo-50">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide mb-1">Continue where you left off</div>
              <div className="font-semibold text-gray-900">{resumeItem.title}</div>
              <div className="text-sm text-gray-500 mt-0.5 capitalize">{resumeItem.skill} · {resumeItem.level}</div>
            </div>
            <Button onClick={() => onStart(resumeItem)}>Continue →</Button>
          </div>
        </Card>
      )}

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Your progress</h2>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {progress.map(p => (
          <Card key={`${p.skill}-${p.level}`} className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-xl">{p.skill === "grammar" ? "📖" : p.skill === "vocabulary" ? "🔤" : "🎤"}</div>
              <div>
                <div className="text-sm font-medium text-gray-900 capitalize">{p.skill}</div>
                <CEFRBadge level={p.level} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-1">{p.avg_score}%</div>
            <ProgressBar value={p.avg_score} color={p.avg_score >= 80 ? "green" : "indigo"} />
            <div className="text-xs text-gray-400 mt-2">{p.exercises_completed} exercises done</div>
          </Card>
        ))}
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-4">Assignments due</h2>
      <Card>
        {MOCK_DB.assignments.filter(a => a.is_published).map(a => (
          <div key={a.id} className="flex items-center gap-4 px-6 py-4 border-b border-gray-50 last:border-0">
            <div className="text-2xl">📝</div>
            <div className="flex-1">
              <div className="font-medium text-gray-900">{a.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">Due {a.due_date} · {a.skill} · <CEFRBadge level={a.level} /></div>
            </div>
            <Badge color="yellow">Due soon</Badge>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ContentList({ skill, level, onSelect }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const icons = { grammar: "📖", vocabulary: "🔤", speaking: "🎤" };

  useEffect(() => {
    setLoading(true);
    setError("");
    api.getContent({ skill, level, limit: 200 })
      .then(data => setItems(data.items || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [skill, level]);

  // Group items by lesson number extracted from title "Lesson N: ..."
  const lessons = useMemo(() => {
    const map = {};
    items.forEach(item => {
      const m = item.title?.match(/Lesson\s+(\d+)/i);
      const num = m ? parseInt(m[1]) : 0;
      if (!map[num]) map[num] = { number: num, title: item.title?.replace(/\s*—\s*Exercise.*$/i, '').replace(/Lesson\s+\d+:\s*/i, '').trim() || item.title, exercises: [] };
      map[num].exercises.push(item);
    });
    return Object.values(map).sort((a, b) => a.number - b.number);
  }, [items]);

  // If only 1 exercise type per lesson (grammar style), show individual exercises
  // If multiple exercises per lesson (vocabulary style), show grouped lessons
  const showGrouped = lessons.some(l => l.exercises.length > 1);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1 capitalize">{skill}</h1>
      <div className="flex items-center gap-2 mb-8">
        <CEFRBadge level={level} />
        <span className="text-sm text-gray-500">
          {loading ? "Loading…" : showGrouped ? `${lessons.length} lessons` : `${items.length} exercises`}
        </span>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">⚠️ {error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {showGrouped ? (
            // Vocabulary style: one card per lesson, click opens first exercise
            lessons.map(lesson => (
              <Card key={lesson.number} className="p-5 hover:border-indigo-300 transition-colors cursor-pointer"
                onClick={() => {
                  console.log('Lesson clicked:', lesson.number, 'exercises:', lesson.exercises.length);
                  onSelect({ ...lesson.exercises[0], _lessonExercises: lesson.exercises, _lessonTitle: lesson.title });
                }}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-xl">
                    {icons[skill] || "📚"}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">
                      Lesson {lesson.number} — {lesson.title}
                    </div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {lesson.exercises.length} exercises
                    </div>
                  </div>
                  <span className="text-gray-300 text-lg">→</span>
                </div>
              </Card>
            ))
          ) : (
            // Grammar style: one card per exercise
            items.map(item => (
              <Card key={item.id} className="p-5 hover:border-indigo-300 transition-colors cursor-pointer" onClick={() => onSelect(item)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-xl">
                    {icons[item.skill] || "📚"}
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900">{item.title}</div>
                    <div className="text-sm text-gray-500 mt-0.5 capitalize">{item.type.replace("_", " ")}</div>
                  </div>
                  <span className="text-gray-300 text-lg">→</span>
                </div>
              </Card>
            ))
          )}
          {items.length === 0 && (
            <EmptyState icon="📚" title="No exercises yet" description="Content for this level and skill is coming soon." />
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EXERCISE VIEW
// ─────────────────────────────────────────────────────────────

function ExerciseView({ item, onBack }) {
  const exercises = item._lessonExercises || [item];
  const lessonTitle = item._lessonTitle || item.title?.replace(/\s*[—\-]\s*Exercise.*$/i, '').replace(/Lesson\s+\d+[:\s]+/i, '').trim();

  const typeComponents = {
    multiple_choice: MultipleChoiceExercise,
    fill_blank: FillBlankExercise,
    matching: MatchingExercise,
    sentence_reorder: SentenceReorderExercise,
    rewrite: WrittenExercise,
    short_answer: WrittenExercise,
    error_correction: WrittenExercise,
    sort: SortExercise,
    true_false: TrueFalseExercise,
    dictation: DictationExercise,
    read_aloud: ReadAloudExercise,
    picture_description: PictureDescriptionExercise,
  };

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6">
        ← Back
      </button>
      <div className="flex items-center gap-3 mb-8">
        <CEFRBadge level={exercises[0]?.level} />
        <h1 className="text-xl font-bold text-gray-900">{lessonTitle}</h1>
      </div>
      <div className="space-y-10">
        {exercises.map((ex, idx) => {
          const Component = typeComponents[ex.type];
          const exLetter = ex.title?.match(/Exercise\s+([A-G])/i)?.[1] || String.fromCharCode(65 + idx);
          return (
            <div key={ex.id || idx}>
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold">{exLetter}</span>
                <span className="text-sm font-medium text-gray-500 capitalize">{ex.type.replace(/_/g, ' ')}</span>
              </div>
              {Component
                ? <Component item={ex} onNext={null} />
                : <div className="text-gray-400 text-sm italic">Exercise type not yet supported.</div>
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MultipleChoiceExercise({ item, onNext }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const { items, instructions } = item.body;

  function submit() { setSubmitted(true); }
  const score = submitted ? Math.round(items.filter(q => answers[q.id] === q.correct).length / items.length * 100) : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="space-y-6">
        {items.map(q => (
          <div key={q.id} className={submitted ? "opacity-100" : ""}>
            <p className="font-medium text-gray-900 mb-3">{q.id}. {q.prompt}</p>
            <div className="grid grid-cols-2 gap-2">
              {q.options.map((opt, j) => {
                const selected = answers[q.id] === j;
                const correct = q.correct === j;
                let cls = "p-3 rounded-lg border-2 text-sm cursor-pointer transition-all text-left ";
                if (submitted) {
                  if (correct) cls += "border-green-400 bg-green-50 text-green-800 font-medium";
                  else if (selected && !correct) cls += "border-red-300 bg-red-50 text-red-700";
                  else cls += "border-gray-200 text-gray-500";
                } else {
                  cls += selected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-indigo-300 text-gray-700";
                }
                return (
                  <button key={j} className={cls} onClick={() => !submitted && setAnswers(a => ({ ...a, [q.id]: j }))}>
                    <span className="font-medium mr-2">{String.fromCharCode(65 + j)}.</span>{opt}
                  </button>
                );
              })}
            </div>
            {submitted && answers[q.id] !== q.correct && (
              <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg px-3 py-2">💡 {q.explanation}</p>
            )}
          </div>
        ))}
      </div>
      {!submitted ? (
        <Button onClick={submit} disabled={Object.keys(answers).length < items.length} className="mt-6">
          Submit answers
        </Button>
      ) : (
        <div className="mt-6 p-4 rounded-xl text-center" style={{ background: score >= 80 ? "#f0fdf4" : score >= 60 ? "#fffbeb" : "#fef2f2" }}>
          <div className="text-3xl font-bold mb-1" style={{ color: score >= 80 ? "#16a34a" : score >= 60 ? "#d97706" : "#dc2626" }}>{score}%</div>
          <div className="text-sm text-gray-600">{score >= 80 ? "Excellent work! 🎉" : score >= 60 ? "Good effort! Review the explanations." : "Keep practising — you'll get there!"}</div>
          {onNext && <button onClick={onNext} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Next Exercise ▶</button>}
        </div>
      )}
    </Card>
  );
}

function FillBlankExercise({ item, onNext }) {
  const [answers, setAnswers] = useState({}); // answers[q.id] = array, one entry per blank
  const [submitted, setSubmitted] = useState(false);
  const { items, instructions } = item.body;

  // Blanks are runs of 2+ underscores of any length -- source files aren't
  // consistent about using exactly 5. A sentence can have more than one blank
  // (e.g. "I have ___ meeting with ___ manager"), in which case the answer key
  // gives one answer per blank separated by "/" (e.g. "a / the").
  function segments(q) { return q.prompt.split(/_{2,}/); }
  function expectedAnswers(q) { return (q.answer || '').split('/').map(a => a.trim().toLowerCase()).filter(Boolean); }
  function isCorrect(q) {
    const expected = expectedAnswers(q);
    const given = (answers[q.id] || []).map(a => (a || '').trim().toLowerCase());
    return expected.length > 0 && expected.length === given.length && expected.every((e, i) => e === given[i]);
  }
  function isAnswered(q) {
    const blanks = segments(q).length - 1;
    const given = answers[q.id] || [];
    return blanks > 0 && given.length === blanks && given.every(a => (a || '').trim() !== '');
  }

  function submit() { setSubmitted(true); }
  const score = submitted ? Math.round(items.filter(isCorrect).length / items.length * 100) : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="space-y-5">
        {items.map(q => {
          const parts = segments(q);
          const blankCount = parts.length - 1;
          const correct = submitted && isCorrect(q);
          const wrong = submitted && !correct;
          return (
            <div key={q.id}>
              <div className="flex items-center gap-2 flex-wrap">
                {parts.map((seg, i) => [
                  <span key={`seg-${i}`} className="text-gray-900">{seg}</span>,
                  i < blankCount && (
                    <input
                      key={`blank-${i}`}
                      className={`border-b-2 w-28 px-1 text-center text-sm focus:outline-none transition-colors ${submitted ? (correct ? "border-green-500 text-green-700 bg-green-50" : "border-red-400 text-red-700 bg-red-50") : "border-indigo-400 focus:border-indigo-600"}`}
                      value={(answers[q.id] || [])[i] || ""}
                      onChange={e => !submitted && setAnswers(a => {
                        const arr = [...(a[q.id] || [])];
                        arr[i] = e.target.value;
                        return { ...a, [q.id]: arr };
                      })}
                      disabled={submitted}
                    />
                  ),
                ])}
              </div>
              {wrong && <p className="text-xs text-gray-500 mt-1 ml-4">✓ Answer: <strong>{q.answer}</strong> — {q.explanation}</p>}
            </div>
          );
        })}
      </div>
      {!submitted ? (
        <Button onClick={submit} disabled={!items.every(isAnswered)} className="mt-6">Submit</Button>
      ) : (
        <div className="mt-6 p-4 rounded-xl bg-indigo-50 text-center">
          <div className="text-2xl font-bold text-indigo-700">{score}%</div>
          <div className="text-sm text-gray-600 mt-1">{score >= 80 ? "Great job!" : "Review the correct answers above."}</div>
          {onNext && <button onClick={onNext} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Next Exercise ▶</button>}
        </div>
      )}
    </Card>
  );
}

function MatchingExercise({ item, onNext }) {
  const { items, instructions } = item.body;
  const [matches, setMatches] = useState({});
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  // Build unique definitions list from all items (deduplicated by definition text)
  // Each definition has an id (the item id it came from) for tracking
  const allDefs = [];
  const seen = new Set();
  [...items].sort(() => Math.random() - 0.5).forEach(i => {
    if (i.definition && !seen.has(i.definition)) {
      seen.add(i.definition);
      allDefs.push({ id: i.id, text: i.definition, correctOption: i.correct_option });
    }
  });

  // If no definitions stored, fall back to showing correct_option letters
  const hasDefinitions = items.some(i => i.definition);

  function selectTerm(id) {
    if (submitted) return;
    setSelected(s => s === id ? null : id);
  }

  function selectDef(defText, defId) {
    if (submitted || !selected) return;
    setMatches(m => ({ ...m, [selected]: defText }));
    setSelected(null);
  }

  function isItemCorrect(i) {
    const studentMatch = matches[i.id];
    if (!studentMatch) return false;
    // Check if student matched to the correct definition
    // correct_option tells us which definition is right
    const correctDef = items.find(x => x.correct_option === i.correct_option && x.id === i.id)?.definition;
    if (correctDef) return studentMatch === correctDef;
    // Fallback: direct definition match
    return studentMatch === i.definition;
  }

  const score = submitted
    ? Math.round(items.filter(isItemCorrect).length / items.length * 100)
    : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Terms</div>
          {items.map(i => (
            <button key={i.id}
              onClick={() => selectTerm(i.id)}
              className={`w-full p-3 rounded-lg border-2 text-sm text-left transition-all font-medium ${
                selected === i.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" :
                matches[i.id] ? (submitted ? (isItemCorrect(i) ? "border-green-400 bg-green-50 text-green-800" : "border-red-300 bg-red-50 text-red-700") : "border-teal-400 bg-teal-50 text-teal-700") :
                "border-gray-200 hover:border-indigo-300 text-gray-700"
              }`}>
              {i.term}
              {matches[i.id] && <div className="text-xs font-normal mt-1 opacity-70 truncate">{matches[i.id]}</div>}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Match</div>
          {allDefs.map(def => {
            const isMatched = Object.values(matches).includes(def.text);
            return (
              <button key={def.id}
                onClick={() => selectDef(def.text, def.id)}
                className={`w-full p-3 rounded-lg border-2 text-sm text-left transition-all ${
                  isMatched ? "border-gray-200 bg-gray-50 text-gray-400 cursor-default" :
                  selected ? "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 text-gray-700 cursor-pointer" :
                  "border-gray-200 text-gray-600"
                }`}>
                {def.text}
              </button>
            );
          })}
        </div>
      </div>
      {!submitted ? (
        <Button onClick={() => setSubmitted(true)} disabled={Object.keys(matches).length < items.length}>Check answers</Button>
      ) : (
        <div className="p-4 rounded-xl bg-indigo-50 text-center">
          <div className="text-2xl font-bold text-indigo-700">{score}%</div>
          <div className="text-sm text-gray-600 mt-1">{score === 100 ? "Perfect match! 🎉" : "Check the highlighted answers."}</div>
          {onNext && <button onClick={onNext} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Next Exercise ▶</button>}
        </div>
      )}
    </Card>
  );
}


function WrittenExercise({ item, onNext }) {
  // Generic component for rewrite, short_answer, error_correction
  const { items, instructions } = item.body;
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const score = submitted
    ? Math.round(items.filter(q => {
        const student = (answers[q.id] || '').trim().toLowerCase().replace(/[.,!?]+$/, '');
        const correct = (q.answer || '').trim().toLowerCase().replace(/[.,!?]+$/, '');
        return student === correct;
      }).length / items.length * 100)
    : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="space-y-4">
        {items.map(q => {
          const student = (answers[q.id] || '').trim().toLowerCase().replace(/[.,!?]+$/, '');
          const correct = (q.answer || '').trim().toLowerCase().replace(/[.,!?]+$/, '');
          const isCorrect = submitted && student === correct;
          const isWrong = submitted && student !== correct;
          return (
            <div key={q.id} className="space-y-1">
              <p className="text-sm text-gray-700 font-medium">{q.id}. {q.prompt}</p>
              <input
                type="text"
                disabled={submitted}
                value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Your answer..."
                className={`w-full px-3 py-2 text-sm border-2 rounded-lg outline-none transition-all ${
                  isCorrect ? 'border-green-400 bg-green-50' :
                  isWrong ? 'border-red-300 bg-red-50' :
                  'border-gray-200 focus:border-indigo-400'
                }`}
              />
              {isWrong && <p className="text-xs text-green-700">✓ {q.answer}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        {!submitted ? (
          <Button onClick={() => setSubmitted(true)}>Check answers</Button>
        ) : (
          <div className="p-4 rounded-xl bg-indigo-50 text-center">
            <div className="text-2xl font-bold text-indigo-700">{score}%</div>
            <div className="text-sm text-gray-600 mt-1">{score >= 80 ? "Great job! 🎉" : "Review the correct answers above."}</div>
            {onNext && <button onClick={onNext} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Next Exercise ▶</button>}
          </div>
        )}
      </div>
    </Card>
  );
}

function SortExercise({ item, onNext }) {
  const { items, instructions } = item.body;
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  // Get unique categories
  const categories = [...new Set(items.map(i => i.answer).filter(Boolean))];

  const score = submitted
    ? Math.round(items.filter(q => (answers[q.id] || '').toLowerCase() === (q.answer || '').toLowerCase()).length / items.length * 100)
    : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="space-y-3">
        {items.map(q => {
          const isCorrect = submitted && (answers[q.id] || '').toLowerCase() === (q.answer || '').toLowerCase();
          const isWrong = submitted && (answers[q.id] || '').toLowerCase() !== (q.answer || '').toLowerCase();
          return (
            <div key={q.id} className="flex items-center gap-3">
              <span className="text-sm text-gray-700 flex-1">{q.term || q.prompt}</span>
              <select
                disabled={submitted}
                value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                className={`px-3 py-1.5 text-sm border-2 rounded-lg ${
                  isCorrect ? 'border-green-400 bg-green-50' :
                  isWrong ? 'border-red-300 bg-red-50' :
                  'border-gray-200'
                }`}
              >
                <option value="">Select...</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        {!submitted ? (
          <Button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < items.length}>Check answers</Button>
        ) : (
          <div className="p-4 rounded-xl bg-indigo-50 text-center">
            <div className="text-2xl font-bold text-indigo-700">{score}%</div>
            <div className="text-sm text-gray-600 mt-1">{score >= 80 ? "Great job! 🎉" : "Review the correct answers."}</div>
            {onNext && <button onClick={onNext} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Next Exercise ▶</button>}
          </div>
        )}
      </div>
    </Card>
  );
}

function TrueFalseExercise({ item, onNext }) {
  const { items, instructions } = item.body;
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const normalize = s => (s || '').trim().toLowerCase().replace(/[^a-z]/g, '');

  const score = submitted
    ? Math.round(items.filter(q => normalize(answers[q.id]) === normalize(q.answer)).length / items.length * 100)
    : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="space-y-3">
        {items.map(q => {
          const isCorrect = submitted && normalize(answers[q.id]) === normalize(q.answer);
          const isWrong = submitted && normalize(answers[q.id]) !== normalize(q.answer);
          return (
            <div key={q.id} className={`p-3 rounded-lg border-2 ${isCorrect ? 'border-green-400 bg-green-50' : isWrong ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
              <p className="text-sm text-gray-700 mb-2">{q.id}. {q.prompt}</p>
              <div className="flex gap-2">
                {['TRUE', 'FALSE', 'RIGHT', 'WRONG', 'NOT GIVEN'].filter(opt => 
                  (q.answer?.toUpperCase().includes('TRUE') || q.answer?.toUpperCase().includes('FALSE') || q.answer?.toUpperCase().includes('NOT GIVEN') ? ['TRUE','FALSE','NOT GIVEN'] : ['RIGHT','WRONG']).includes(opt)
                ).map(opt => (
                  <button key={opt} disabled={submitted}
                    onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                    className={`px-3 py-1 text-xs rounded-full border-2 transition-all ${
                      answers[q.id] === opt ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600'
                    }`}>
                    {opt}
                  </button>
                ))}
              </div>
              {isWrong && <p className="text-xs text-green-700 mt-1">✓ {q.answer}</p>}
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        {!submitted ? (
          <Button onClick={() => setSubmitted(true)} disabled={Object.keys(answers).length < items.length}>Check answers</Button>
        ) : (
          <div className="p-4 rounded-xl bg-indigo-50 text-center">
            <div className="text-2xl font-bold text-indigo-700">{score}%</div>
            <div className="text-sm text-gray-600 mt-1">{score >= 80 ? "Great job! 🎉" : "Review the correct answers."}</div>
            {onNext && <button onClick={onNext} className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">Next Exercise ▶</button>}
          </div>
        )}
      </div>
    </Card>
  );
}

function SentenceReorderExercise({ item, onNext }) {
  const { items, instructions } = item.body;
  const [order, setOrder] = useState(() =>
    Object.fromEntries(items.map(q => [q.id, shuffleWords(q.words)]))
  );
  const [submitted, setSubmitted] = useState(false);

  function shuffleWords(words) {
    return [...words].sort(() => Math.random() - 0.5);
  }

  function moveWord(qId, fromIdx, toIdx) {
    if (submitted) return;
    setOrder(o => {
      const arr = [...o[qId]];
      const [w] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, w);
      return { ...o, [qId]: arr };
    });
  }

  function selectWord(qId, idx, selected, setSelected) {
    if (submitted) return;
    if (selected && selected.qId === qId) {
      if (selected.idx === idx) { setSelected(null); return; }
      moveWord(qId, selected.idx, idx);
      setSelected(null);
    } else {
      setSelected({ qId, idx });
    }
  }

  const [selected, setSelected] = useState(null);

  function submit() { setSubmitted(true); }

  function isCorrect(q) {
    const built = order[q.id].join(' ').replace(/\s+([.,!?])/g, '$1');
    const target = q.answer.trim();
    // Compare ignoring case and trailing punctuation
    const normalize = s => s.toLowerCase().replace(/[.,!?]+$/, '').trim();
    return normalize(built) === normalize(target);
  }

  const score = submitted
    ? Math.round(items.filter(isCorrect).length / items.length * 100)
    : null;

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-6">{instructions}</p>
      <div className="space-y-6">
        {items.map(q => {
          const correct = submitted && isCorrect(q);
          return (
            <div key={q.id}>
              <div className="text-sm font-medium text-gray-500 mb-2">Sentence {q.id}</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {order[q.id].map((word, idx) => {
                  const isSelected = selected && selected.qId === q.id && selected.idx === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => selectWord(q.id, idx, selected, setSelected)}
                      disabled={submitted}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all
                        ${submitted
                          ? (correct ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700')
                          : isSelected
                            ? 'border-indigo-500 bg-indigo-100 text-indigo-700'
                            : 'border-gray-200 bg-white text-gray-700 hover:border-indigo-300 cursor-pointer'}`}
                    >
                      {word}
                    </button>
                  );
                })}
              </div>
              {!submitted && (
                <p className="text-xs text-gray-400">Tap a word, then tap where you want to move it.</p>
              )}
              {submitted && !correct && (
                <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-2">
                  ✓ Correct: <strong>{q.answer}</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!submitted ? (
        <Button onClick={submit} className="mt-6">Submit</Button>
      ) : (
        <div className="mt-6 p-4 rounded-xl bg-indigo-50 text-center">
          <div className="text-2xl font-bold text-indigo-700">{score}%</div>
          <div className="text-sm text-gray-600 mt-1">{score === 100 ? "Perfect! 🎉" : "Review the correct order above."}</div>
        </div>
      )}
    </Card>
  );
}

function DictationExercise({ item }) {
  const [responses, setResponses] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const sentences = item.body.sentences;

  async function submit() {
    setLoading(true);
    const combined = sentences.map(s => responses[s.id] || "").join(" ");
    const aiResult = await mockAIScore("dictation", combined);
    setResult(aiResult);
    setLoading(false);
  }

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-2">{item.body.instructions}</p>
      <div className="bg-blue-50 rounded-lg p-3 mb-6 text-sm text-blue-700">🔊 In the full platform, audio plays here. Type what you hear.</div>
      <div className="space-y-5">
        {sentences.map(s => (
          <div key={s.id}>
            <div className="text-sm font-medium text-gray-500 mb-2">Sentence {s.id}</div>
            {result ? (
              <div>
                <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 mb-2">Your answer: <em>{responses[s.id] || "(blank)"}</em></div>
                <div className="text-sm text-green-700 bg-green-50 rounded-lg p-3">Correct: <strong>{s.text}</strong></div>
              </div>
            ) : (
              <textarea
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
                placeholder="Type what you heard…"
                value={responses[s.id] || ""}
                onChange={e => setResponses(r => ({ ...r, [s.id]: e.target.value }))}
              />
            )}
          </div>
        ))}
      </div>
      {!result ? (
        <Button onClick={submit} disabled={loading || Object.values(responses).some(v => !v?.trim())} className="mt-6">
          {loading ? "Scoring with AI…" : "Submit for AI feedback"}
        </Button>
      ) : (
        <AIFeedbackPanel result={result} />
      )}
    </Card>
  );
}

function ReadAloudExercise({ item }) {
  const [textInput, setTextInput] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { passage, instructions, focus_words } = item.body;

  async function submit() {
    setLoading(true);
    const aiResult = await mockAIScore("read_aloud", textInput);
    setResult(aiResult);
    setLoading(false);
  }

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-4">{instructions}</p>
      <div className="bg-gray-50 rounded-xl p-5 mb-5 text-gray-800 leading-relaxed text-base border-l-4 border-indigo-400">
        {passage}
      </div>
      {focus_words?.length > 0 && (
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500">Focus words:</span>
          {focus_words.map(w => <Badge key={w} color="blue">{w}</Badge>)}
        </div>
      )}
      {!result ? (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
            🎤 In the full platform, click to record audio. For this demo, type your transcription below.
          </div>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={3}
            placeholder="Type what you said (or paste a transcription)…"
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
          />
          <Button onClick={submit} disabled={loading || !textInput.trim()}>
            {loading ? "Getting AI feedback…" : "Submit for AI feedback"}
          </Button>
        </>
      ) : (
        <AIFeedbackPanel result={result} />
      )}
    </Card>
  );
}

function PictureDescriptionExercise({ item }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const aiResult = await mockAIScore("picture_description", text);
    setResult(aiResult);
    setLoading(false);
  }

  return (
    <Card className="p-6">
      <p className="text-gray-600 mb-4">Look at the image below and describe what you see.</p>
      <div className="bg-gradient-to-br from-sky-100 to-indigo-100 rounded-xl h-48 flex items-center justify-center mb-5 border-2 border-dashed border-indigo-200">
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-2">🖼️</div>
          <div className="text-sm">Image: A busy market scene</div>
        </div>
      </div>
      {!result ? (
        <>
          <textarea
            className="w-full border border-gray-300 rounded-lg p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={4}
            placeholder="Describe the image in as much detail as you can…"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <Button onClick={submit} disabled={loading || !text.trim()}>
            {loading ? "Getting AI feedback…" : "Submit for AI feedback"}
          </Button>
        </>
      ) : (
        <AIFeedbackPanel result={result} />
      )}
    </Card>
  );
}

function AIFeedbackPanel({ result }) {
  return (
    <div className="mt-6 rounded-xl border border-indigo-200 overflow-hidden">
      <div className="bg-indigo-600 px-5 py-3 flex items-center justify-between">
        <span className="text-white font-semibold text-sm">AI Feedback</span>
        <span className="text-white text-xl font-bold">{result.score}/100</span>
      </div>
      <div className="p-5 bg-indigo-50">
        <p className="text-sm text-gray-700 mb-4">{result.feedback}</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">✓ Strengths</div>
            <ul className="space-y-1">
              {result.strengths.map((s, i) => <li key={i} className="text-sm text-gray-600">• {s}</li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">↑ To improve</div>
            <ul className="space-y-1">
              {result.improvements.map((s, i) => <li key={i} className="text-sm text-gray-600">• {s}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// GAMES VIEW
// ─────────────────────────────────────────────────────────────

function GamesView() {
  const [activeGame, setActiveGame] = useState(null);

  const games = [
    { id: "match", name: "Word Match", icon: "🔗", description: "Match vocabulary to definitions against the clock", mechanic: "matching", level: "A2" },
    { id: "fill", name: "Grammar Blitz", icon: "⚡", description: "Fill in the blanks as fast as you can", mechanic: "fill_blank", level: "A2" },
    { id: "recall", name: "Timed Recall", icon: "⏱️", description: "How many words can you remember?", mechanic: "timed_recall", level: "A2" },
  ];

  if (activeGame) {
    return <WordMatchGame game={activeGame} onBack={() => setActiveGame(null)} />;
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Games</h1>
      <p className="text-gray-500 mb-8">Practice your A2 vocabulary and grammar through interactive games</p>
      <div className="grid grid-cols-3 gap-4">
        {games.map(g => (
          <Card key={g.id} className="p-6 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all" onClick={() => setActiveGame(g)}>
            <div className="text-4xl mb-3">{g.icon}</div>
            <div className="font-semibold text-gray-900 mb-1">{g.name}</div>
            <div className="text-xs text-gray-500 mb-3">{g.description}</div>
            <CEFRBadge level={g.level} />
          </Card>
        ))}
      </div>
    </div>
  );
}

function WordMatchGame({ game, onBack }) {
  const pairs = MOCK_DB.content.find(c => c.type === "matching")?.body?.items || [];
  const [matched, setMatched] = useState([]);
  const [selected, setSelected] = useState(null);
  const [time, setTime] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (matched.length === pairs.length && pairs.length > 0) setDone(true);
  }, [matched]);

  function pickTerm(id) {
    if (matched.find(m => m.term === id)) return;
    setSelected(s => s?.type === "term" && s.id === id ? null : { type: "term", id });
  }

  function pickDef(id) {
    if (matched.find(m => m.def === id)) return;
    if (selected?.type === "term") {
      const term = pairs.find(p => p.id === selected.id);
      const def = pairs.find(p => p.id === id);
      if (term && def) {
        if (term.id === def.id) {
          setMatched(m => [...m, { term: term.id, def: def.id }]);
        }
        setSelected(null);
      }
    }
  }

  const shuffled = [...pairs].sort(() => 0.5 - Math.random());

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={onBack} className="text-sm text-gray-500 mb-6 flex items-center gap-1">← Back to games</button>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{game.name}</h1>
        <div className="text-lg font-mono text-gray-600">{String(Math.floor(time / 60)).padStart(2, "0")}:{String(time % 60).padStart(2, "0")}</div>
      </div>

      {done ? (
        <Card className="p-10 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">You matched them all!</h2>
          <p className="text-gray-500 mb-6">Completed in {time} seconds</p>
          <Button onClick={() => { setMatched([]); setSelected(null); setTime(0); setDone(false); }}>Play again</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Words</div>
            {pairs.map(p => {
              const isMatched = matched.find(m => m.term === p.id);
              const isSelected = selected?.type === "term" && selected.id === p.id;
              return (
                <button key={p.id} onClick={() => pickTerm(p.id)}
                  className={`w-full p-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${isMatched ? "border-green-400 bg-green-50 text-green-700" : isSelected ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 hover:border-indigo-300 text-gray-700"}`}>
                  {p.term}
                </button>
              );
            })}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Definitions</div>
            {shuffled.map(p => {
              const isMatched = matched.find(m => m.def === p.id);
              return (
                <button key={p.id} onClick={() => pickDef(p.id)}
                  className={`w-full p-3 rounded-lg border-2 text-sm text-left transition-all ${isMatched ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 hover:border-indigo-300 text-gray-700 hover:bg-indigo-50"}`}>
                  {p.definition}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentAssignmentsView() {
  const assignments = MOCK_DB.assignments.filter(a => a.is_published);

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">My Assignments</h1>
      <p className="text-gray-500 mb-8">{assignments.length} assignment{assignments.length !== 1 ? "s" : ""} assigned to you</p>
      <div className="space-y-4">
        {assignments.map(a => (
          <Card key={a.id} className="p-5">
            <div className="flex items-center gap-4">
              <div className="text-3xl">📝</div>
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{a.title}</div>
                <div className="flex items-center gap-2 mt-1">
                  <CEFRBadge level={a.level} />
                  <span className="text-xs text-gray-500 capitalize">{a.type} · {a.skill}</span>
                  <span className="text-xs text-gray-400">Due {a.due_date}</span>
                </div>
              </div>
              <Badge color="yellow">Not started</Badge>
            </div>
          </Card>
        ))}
        {assignments.length === 0 && (
          <EmptyState icon="✅" title="All caught up!" description="No assignments due. Keep practising your exercises." />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [school, setSchool] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // On load, try to restore session from a saved token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setCheckingSession(false); return; }
    api.me()
      .then(data => { setUser(data.user); setSchool(data.school); })
      .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('school_slug'); })
      .finally(() => setCheckingSession(false));
  }, []);

  function handleLogin(u, s) { setUser(u); setSchool(s); }
  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('school_slug');
    setUser(null);
    setSchool(null);
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <AuthCtx.Provider value={{ user, school, logout: handleLogout }}>
      {user.role === "admin" && <AdminDashboard />}
      {user.role === "teacher" && <TeacherDashboard />}
      {user.role === "student" && <StudentDashboard />}
    </AuthCtx.Provider>
  );
}
