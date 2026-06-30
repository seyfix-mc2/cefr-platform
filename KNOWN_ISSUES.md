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
