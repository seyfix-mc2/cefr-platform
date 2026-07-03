# Known Issues — To Fix Next

## High priority
- [ ] **Teacher cannot add new students** — reported during testing. The button/flow exists in the UI but doesn't successfully create a student. Needs investigation (likely same class of bug as the Card onClick issue — a prop not being passed, or the API call not wired to the real backend yet).

## Medium priority (not yet wired to real API — still using MOCK_DB demo data)
- [ ] Teacher dashboard: roster, student progress drill-down
- [ ] Vocabulary content list (same fix pattern as Grammar ContentList — should be fast)
- [ ] Speaking exercises + AI feedback (currently uses `mockAIScore`, not real Claude API)
- [ ] Games (matching game uses MOCK_DB content)
- [ ] Admin: school-wide progress rollup
- [ ] Admin: branding save (form exists, doesn't persist)
- [ ] Assignment generation (AI draft flow uses mock data, not real `/assignments/generate`)

## Notes for next session
Pattern observed throughout this build: components were scaffolded with mock data first,
and several were never reconnected to the real API. When testing, the most reliable way to
find these is to actually click through every flow as each role (admin/teacher/student) and
watch the Network tab — if a button does nothing or data doesn't match what's in the database,
it's almost certainly still pointing at MOCK_DB.

## Feature requests (future phases)

### Customizable curriculum per school
Admin can reorder, rename, add, and hide lessons in the Content Library.
Each school stores its own curriculum order in a `curriculum` JSONB column on the `schools` table.
Students see lessons in the school's custom order.
Implementation: per-school curriculum JSON + dnd-kit for drag-and-drop reordering.
Build AFTER all content is uploaded and core platform is stable.

### Student level access
Currently students are assigned a single CEFR level and can only see content for that level.
Consider: allow students to access content one level below their assigned level for revision.

---
## Session notes — pick up here next time

### A2 Vocabulary upload still failing
- Error: "No exercises could be parsed from the file"
- Server receives file correctly (confirmed via logs)
- \r\n fix deployed and confirmed working
- Local parser works fine on A2_L2_single.txt
- Server still returns 0 exercises for same file
- Next step: check if the server is actually loading the latest contentParser.js
  by adding a unique string to the parser and verifying it appears in logs
- Files ready: A2_L2_single.txt (single lesson test file)

### Content uploaded so far
- A1 Grammar: ready to upload (31 lessons)
- A2 Grammar: ready to upload (30 lessons)  
- B1 Grammar: ready to upload (30 lessons)
- B2 Grammar: ready to upload (40 lessons)
- A1 Vocabulary: 30/30 uploaded ✅
- A2 Vocabulary: 0/20 uploaded (upload bug blocking)
- B1 Vocabulary: 1/20 uploaded ✅ (Lesson 1 Personal Qualities)
- B2 Vocabulary: pending

### Student dashboard
- Grammar page pulls from real API ✅
- Vocabulary page still uses MOCK_DB — needs wiring to real API
- Progress tracking not yet wired to real database

### Parser format specification
- Documented in this session — exact format for all exercise types
- A-G exercise letters supported
- Inline | ANSWER: pipe format supported
- Matching with separate lettered definitions supported
- \r\n Windows line endings handled on server
