-- ============================================================
-- CEFR Language Learning Platform — Initial Schema
-- Multi-tenant, shared schema, row-level isolation via school_id
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- SCHOOLS (tenants)
-- ============================================================
CREATE TABLE schools (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,           -- subdomain key
  license_key   TEXT NOT NULL UNIQUE,
  license_expiry DATE NOT NULL,
  seats_teachers INTEGER NOT NULL DEFAULT 5,
  seats_students INTEGER NOT NULL DEFAULT 100,
  unlocked_modules TEXT[] NOT NULL DEFAULT ARRAY['grammar','vocabulary','speaking','games'],
  -- Branding
  logo_url      TEXT,
  primary_color TEXT NOT NULL DEFAULT '#4F46E5',
  school_display_name TEXT,
  -- Meta
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS (admin / teacher / student)
-- ============================================================
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  display_name  TEXT,
  -- Students only
  class_id      UUID,   -- FK added after classes table
  cefr_level    TEXT CHECK (cefr_level IN ('A1','A2','B1','B2')),
  created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Username unique per school (not globally)
  UNIQUE (school_id, username)
);

-- ============================================================
-- CLASSES
-- ============================================================
CREATE TABLE classes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  cefr_level  TEXT CHECK (cefr_level IN ('A1','A2','B1','B2')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now we can add the FK from users to classes
ALTER TABLE users ADD CONSTRAINT fk_users_class
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- ============================================================
-- CONTENT ITEMS
-- Content is school-agnostic (global library) but can be
-- school-specific if school_id is set (teacher-generated).
-- ============================================================
CREATE TABLE content_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID REFERENCES schools(id) ON DELETE CASCADE,  -- NULL = global
  level       TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2')),
  skill       TEXT NOT NULL CHECK (skill IN ('grammar','vocabulary','speaking','reading','listening','writing')),
  type        TEXT NOT NULL,
  -- Exercise types: multiple_choice | fill_blank | matching | sentence_reorder
  --                 dictation | read_aloud | picture_description
  title       TEXT,
  tags        TEXT[] NOT NULL DEFAULT '{}',
  body        JSONB NOT NULL,   -- exercise data (schema documented separately)
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- GAME TEMPLATES
-- ============================================================
CREATE TABLE game_templates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id             UUID REFERENCES schools(id) ON DELETE CASCADE,
  skill                 TEXT NOT NULL,
  level                 TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2')),
  mechanic_type         TEXT NOT NULL CHECK (mechanic_type IN (
                          'matching','fill_blank','timed_recall',
                          'word_sort','sentence_builder','flashcard'
                        )),
  linked_content_item_ids UUID[] NOT NULL DEFAULT '{}',
  name                  TEXT NOT NULL,
  config                JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SPEAKING ATTEMPTS
-- ============================================================
CREATE TABLE speaking_attempts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id             UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_item_id       UUID NOT NULL REFERENCES content_items(id),
  type                  TEXT NOT NULL CHECK (type IN ('dictation','read_aloud','picture_description')),
  -- Input: one of these will be set
  audio_url             TEXT,
  text_response         TEXT,
  -- AI output
  ai_score              NUMERIC(5,2),            -- 0–100
  ai_feedback_text      TEXT,
  ai_feedback_audio_url TEXT,
  ai_raw_response       JSONB,
  -- Audio retention: mark for deletion after retention period
  audio_expires_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSIGNMENTS
-- ============================================================
CREATE TABLE assignments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id         UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              TEXT NOT NULL CHECK (type IN ('quiz','homework','exam')),
  level             TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2')),
  skill             TEXT NOT NULL,
  title             TEXT NOT NULL,
  generated_content JSONB NOT NULL,              -- questions + answer key
  due_date          DATE,
  -- Target: class or specific students (one or the other)
  class_id          UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_ids       UUID[] DEFAULT '{}',
  is_published      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ASSIGNMENT SUBMISSIONS
-- ============================================================
CREATE TABLE assignment_submissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id     UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answers       JSONB NOT NULL DEFAULT '{}',
  score         NUMERIC(5,2),
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (assignment_id, student_id)
);

-- ============================================================
-- PROGRESS SNAPSHOTS
-- Recomputed on each submission for fast dashboard reads
-- ============================================================
CREATE TABLE progress_snapshots (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill       TEXT NOT NULL,
  level       TEXT NOT NULL CHECK (level IN ('A1','A2','B1','B2')),
  exercises_completed INTEGER NOT NULL DEFAULT 0,
  exercises_correct   INTEGER NOT NULL DEFAULT 0,
  avg_score           NUMERIC(5,2),
  last_activity_at    TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, skill, level)
);

-- ============================================================
-- INDEXES
-- ============================================================
-- Tenant isolation — most frequent filter
CREATE INDEX idx_users_school          ON users(school_id);
CREATE INDEX idx_classes_school        ON classes(school_id);
CREATE INDEX idx_content_items_level   ON content_items(level, skill);
CREATE INDEX idx_speaking_student      ON speaking_attempts(student_id, created_at DESC);
CREATE INDEX idx_speaking_school       ON speaking_attempts(school_id);
CREATE INDEX idx_assignments_school    ON assignments(school_id, teacher_id);
CREATE INDEX idx_submissions_student   ON assignment_submissions(student_id);
CREATE INDEX idx_progress_student      ON progress_snapshots(student_id);
CREATE INDEX idx_progress_school       ON progress_snapshots(school_id);
-- Audio retention cleanup
CREATE INDEX idx_speaking_audio_expiry ON speaking_attempts(audio_expires_at)
  WHERE audio_expires_at IS NOT NULL;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON schools
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
