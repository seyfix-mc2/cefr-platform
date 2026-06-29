# CEFR Language Learning Platform

White-label, multi-tenant language learning platform for language schools. Covers CEFR levels A1–B2 with teacher and student dashboards, AI-powered speaking feedback, and teacher-facing content generation.

---

## Architecture

```
cefr-platform/
├── backend/                    # Node.js/Express REST API
│   ├── migrations/
│   │   └── 001_initial_schema.sql   # Full Postgres schema
│   └── src/
│       ├── index.js                 # Express entry point
│       ├── middleware/
│       │   ├── tenant.js            # Subdomain → school_id resolution
│       │   └── auth.js              # JWT + role guards
│       ├── routes/
│       │   ├── auth.js              # Login, /me
│       │   ├── admin.js             # Teacher CRUD, license, branding
│       │   ├── teacher.js           # Classes, students, CSV import
│       │   ├── content.js           # Content items + game templates
│       │   ├── speaking.js          # Speaking submissions + AI scoring
│       │   ├── assignments.js       # Generate, create, submit, grade
│       │   └── progress.js          # Student progress snapshots
│       ├── ai/
│       │   ├── speaking.js          # Single-request AI scoring (no chat)
│       │   └── generate.js          # Teacher-facing quiz/homework generation
│       └── db/
│           ├── pool.js              # Postgres connection pool
│           ├── migrate.js           # Run migrations
│           └── seed.js              # Development seed data
│
└── frontend/                   # React + Tailwind SPA
    └── src/
        ├── lib/api.js               # API client with tenant + JWT headers
        ├── hooks/useAuth.jsx         # Auth context
        └── components/              # Role-separated UI components
```

---

## Multi-tenancy

- **Architecture**: Shared schema, row-level isolation via `school_id` on every table
- **Routing**: Wildcard DNS → `resolveTenant` middleware resolves `{slug}.yourplatform.com` to a `school` row
- **Local dev**: Override with `X-School-Slug: demo` header (or env var)
- **JWT scoping**: Every token includes `school_id`; middleware cross-checks on every request
- **Seat limits**: Teacher and student seats enforced at creation time

---

## AI Integration

Two and only two AI call sites, both single-request/single-response:

### 1. Speaking feedback (student-facing)
- Routes: `POST /speaking/attempts`
- File: `src/ai/speaking.js`
- Types: `dictation` | `read_aloud` | `picture_description`
- System prompt explicitly prohibits follow-up questions or dialogue
- Returns: `{ score, feedback, strengths, improvements }` as JSON

### 2. Content generation (teacher-facing)
- Route: `POST /assignments/generate`
- File: `src/ai/generate.js`
- Teacher → selects level/skill/topic/question types → draft returned → teacher edits → assigns
- AI output never reaches students without teacher review

---

## Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 14+
- Anthropic API key

### Backend

```bash
cd backend
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY

npm install
npm run migrate    # Creates all tables + indexes
npm run seed       # Creates demo school, admin, teacher, students
npm run dev        # Starts on port 3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev        # Starts on port 3000
```

### Demo credentials
| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Teacher | `teacher1` | `teacher123` |
| Student | `alice` | `student123` |

Subdomain for dev: use `X-School-Slug: demo` header, or set `localStorage.setItem('dev_school_slug', 'demo')` in the browser console.

---

## API Routes

### Auth (public — tenant required, no JWT)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | `{ username, password }` → `{ token, user, school }` |
| GET | `/auth/me` | Verify token, return current user |

### Admin (`role: admin`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/teachers` | List teachers with stats |
| POST | `/admin/teachers` | Create teacher account |
| PATCH | `/admin/teachers/:id` | Deactivate/update teacher |
| GET | `/admin/license` | License status + seat counts |
| PATCH | `/admin/branding` | Update logo, color, display name |
| GET | `/admin/progress` | School-wide aggregate progress |

### Teacher (`role: admin | teacher`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/teacher/classes` | List classes |
| POST | `/teacher/classes` | Create class |
| GET | `/teacher/classes/:id/students` | Roster with progress |
| POST | `/teacher/classes/:id/students` | Create student |
| POST | `/teacher/classes/:id/students/import` | Bulk CSV import |
| GET | `/teacher/students/:id/progress` | Full student detail |

### Content (`all roles`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/content?level=A2&skill=grammar` | List content items |
| GET | `/content/:id` | Single item |
| GET | `/content/games/templates` | Game templates |

### Speaking
| Method | Path | Description |
|--------|------|-------------|
| POST | `/speaking/attempts` | Submit + get AI feedback (student only) |
| GET | `/speaking/attempts` | My attempts or `?student_id=` for teacher |

### Assignments
| Method | Path | Description |
|--------|------|-------------|
| POST | `/assignments/generate` | AI draft (teacher) |
| POST | `/assignments` | Save assignment |
| GET | `/assignments` | List (role-aware) |
| GET | `/assignments/:id` | Single (strips answer key for students) |
| PATCH | `/assignments/:id` | Publish / update |
| POST | `/assignments/:id/submit` | Student submits answers |
| GET | `/assignments/:id/results` | Teacher sees all submissions |

### Progress (`role: student`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/progress` | All skill/level snapshots |
| GET | `/progress/resume` | Last-touched content item |

---

## Content Schema (body field)

### `multiple_choice`
```json
{
  "instructions": "Choose the correct form.",
  "items": [
    { "id": 1, "prompt": "She _____ to work.", "options": ["go","goes","went","going"], "correct": 1, "explanation": "..." }
  ]
}
```

### `fill_blank`
```json
{
  "instructions": "Fill in the blank.",
  "items": [
    { "id": 1, "prompt": "She was born _____ July.", "answer": "in", "explanation": "Use 'in' with months." }
  ]
}
```

### `matching`
```json
{
  "instructions": "Match each word to its definition.",
  "items": [
    { "id": 1, "term": "commute", "definition": "Travel regularly between home and work" }
  ]
}
```

### `sentence_reorder`
```json
{
  "instructions": "Put the words in order.",
  "items": [
    { "id": 1, "words": ["She","goes","to","school"], "answer": "She goes to school." }
  ]
}
```

### `dictation`
```json
{
  "instructions": "Listen and type what you hear.",
  "sentences": [
    { "id": 1, "text": "She goes to work by bus.", "audio_url": "https://..." }
  ]
}
```

### `read_aloud`
```json
{
  "instructions": "Read this passage aloud.",
  "passage": "Full text here...",
  "focus_words": ["breakfast", "centre"],
  "target_pronunciation": ["centre /ˈsentə/"]
}
```

### `picture_description`
```json
{
  "instructions": "Describe what you see.",
  "image_url": "https://...",
  "picture_description": "A busy market scene",
  "expected_vocabulary": ["stall", "vendor", "crowd"]
}
```

---

## Build Order (from prompt spec)

- [x] **Stage 1**: Schema + migrations
- [x] **Stage 2**: Auth + subdomain tenant resolution
- [x] **Stage 3**: Admin dashboard (teacher CRUD, license display)
- [x] **Stage 4**: Content ingestion + student rendering (grammar/vocabulary)
- [x] **Stage 5**: Speaking exercises + AI scoring pipeline
- [x] **Stage 6**: Teacher dashboard: roster + progress views
- [x] **Stage 7**: Teacher AI content generation flow
- [x] **Stage 8**: Games engine wired to ContentItem/GameTemplate
- [ ] **Stage 9**: Polish: per-tenant branding/theming, CSV upload UI

---

## Phase 2 (not built, schema-ready)
Reading, listening, writing modules. The `ContentItem.skill` and `Assignment.skill` columns accept any value; add `CHECK` constraint values when implementing.

## Non-functional checklist
- [x] Tenant isolation at data-access layer (every query uses `school_id`)
- [x] No public registration endpoint
- [x] Bulk student CSV import (`/students/import`)
- [x] Data minimization: username-only students, no email required
- [x] Audio retention: 90-day expiry flag on `speaking_attempts.audio_expires_at`
- [x] Seat limit enforcement server-side
- [x] JWT scoped to `school_id`
- [x] Passwords hashed with bcryptjs (cost factor 12)
