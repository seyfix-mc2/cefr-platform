import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api.js';

// ─── Lesson catalogue (placeholders) ───────────────────────────
const CATALOGUE = {
  grammar: {
    A1: [
      { number: 1,  title: 'The verb "to be" (affirmative)', exercises: ['fill_blank','matching','sentence_reorder'] },
      { number: 2,  title: 'The verb "to be" (negative & questions)', exercises: ['rewrite','sentence_reorder','short_answer'] },
      { number: 3,  title: 'Subject Pronouns', exercises: ['matching','fill_blank','error_correction'] },
      { number: 4,  title: 'Possessive Adjectives', exercises: ['matching','fill_blank','error_correction'] },
      { number: 5,  title: 'Articles: a / an', exercises: ['matching','fill_blank','sort'] },
      { number: 6,  title: 'Articles: the & zero article', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 7,  title: 'Singular and Plural Nouns', exercises: ['rewrite','fill_blank','sort'] },
      { number: 8,  title: 'Demonstratives: this / that / these / those', exercises: ['matching','fill_blank','sentence_reorder'] },
      { number: 9,  title: 'There is / There are', exercises: ['matching','fill_blank','true_false'] },
      { number: 10, title: 'Simple Present (affirmative)', exercises: ['fill_blank','sentence_reorder','matching'] },
      { number: 11, title: 'Simple Present (negative)', exercises: ['fill_blank','rewrite','error_correction'] },
      { number: 12, title: 'Simple Present (yes/no questions & short answers)', exercises: ['sentence_reorder','short_answer','multiple_choice'] },
      { number: 13, title: 'Simple Present (Wh- Questions)', exercises: ['fill_blank','sentence_reorder','matching'] },
      { number: 14, title: 'Adverbs of Frequency', exercises: ['sort','fill_blank','error_correction'] },
      { number: 15, title: 'Present Continuous (affirmative & negative)', exercises: ['fill_blank','rewrite','sentence_reorder'] },
      { number: 16, title: 'Present Continuous (questions)', exercises: ['sentence_reorder','short_answer','multiple_choice'] },
      { number: 17, title: "Possessive 's", exercises: ['rewrite','fill_blank','multiple_choice'] },
      { number: 18, title: 'Object Pronouns', exercises: ['rewrite','fill_blank','multiple_choice'] },
      { number: 19, title: 'Adjectives (position & basic use)', exercises: ['sentence_reorder','fill_blank','error_correction'] },
      { number: 20, title: 'Imperatives (affirmative & negative)', exercises: ['rewrite','fill_blank','matching'] },
      { number: 21, title: "Can / Can't (ability & permission)", exercises: ['fill_blank','sentence_reorder','multiple_choice'] },
      { number: 22, title: 'Would like (requests & offers)', exercises: ['fill_blank','rewrite','short_answer'] },
      { number: 23, title: 'Countable & Uncountable Nouns (some / any)', exercises: ['sort','fill_blank','error_correction'] },
      { number: 24, title: 'Simple Past (verb "to be": was / were)', exercises: ['fill_blank','matching','error_correction'] },
      { number: 25, title: 'Simple Past (regular verbs)', exercises: ['rewrite','fill_blank','sentence_reorder'] },
      { number: 26, title: 'Simple Past (irregular verbs)', exercises: ['matching','fill_blank','error_correction'] },
      { number: 27, title: 'Simple Past (negatives & questions)', exercises: ['rewrite','sentence_reorder','short_answer'] },
      { number: 28, title: 'Simple Past (Wh- Questions)', exercises: ['fill_blank','sentence_reorder','matching'] },
      { number: 29, title: 'Basic Prepositions of Place (in, on, at)', exercises: ['fill_blank','matching','error_correction'] },
      { number: 30, title: 'Basic Prepositions of Time (at, on, in)', exercises: ['sort','fill_blank','multiple_choice'] },
      { number: 31, title: 'Basic Conjunctions (and, but, or, because)', exercises: ['matching','fill_blank','rewrite'] },
    ],
    A2: [
      { number: 1,  title: 'Present Simple — Review & Extension', exercises: ['fill_blank', 'multiple_choice', 'matching'] },
      { number: 2,  title: 'Present Continuous', exercises: ['matching', 'fill_blank', 'error_correction'] },
      { number: 3,  title: 'Present Simple vs. Present Continuous', exercises: ['multiple_choice', 'rewrite', 'sort'] },
      { number: 4,  title: 'Past Simple — Regular Verbs', exercises: ['fill_blank', 'error_correction', 'rewrite'] },
      { number: 5,  title: 'Past Simple — Irregular Verbs', exercises: ['matching', 'multiple_choice', 'fill_blank'] },
      { number: 6,  title: 'Past Simple — Negatives & Questions', exercises: ['rewrite', 'error_correction', 'sentence_reorder'] },
      { number: 7,  title: 'Past Continuous', exercises: ['fill_blank', 'multiple_choice', 'true_false'] },
      { number: 8,  title: 'Past Simple vs. Past Continuous', exercises: ['sort', 'error_correction', 'fill_blank'] },
      { number: 9,  title: 'Future with "going to"', exercises: ['fill_blank', 'rewrite', 'multiple_choice'] },
      { number: 10, title: 'Future with "will"', exercises: ['multiple_choice', 'error_correction', 'multiple_choice'] },
      { number: 11, title: '"Going to" vs. "Will"', exercises: ['sort', 'fill_blank', 'multiple_choice'] },
      { number: 12, title: 'Present Perfect — Introduction', exercises: ['fill_blank', 'multiple_choice', 'error_correction'] },
      { number: 13, title: 'Present Perfect with "ever / never / already / yet"', exercises: ['rewrite', 'fill_blank', 'sentence_reorder'] },
      { number: 14, title: 'Modal Verbs — can / can\'t (Ability & Possibility)', exercises: ['multiple_choice', 'multiple_choice', 'error_correction'] },
      { number: 15, title: 'Modal Verbs — should / shouldn\'t', exercises: ['fill_blank', 'matching', 'rewrite'] },
      { number: 16, title: 'Modal Verbs — must / have to / don\'t have to', exercises: ['sort', 'multiple_choice', 'error_correction'] },
      { number: 17, title: 'Articles — a, an, the, zero article', exercises: ['fill_blank', 'error_correction', 'multiple_choice'] },
      { number: 18, title: 'Countable & Uncountable Nouns', exercises: ['sort', 'fill_blank', 'error_correction'] },
      { number: 19, title: 'Quantifiers', exercises: ['multiple_choice', 'fill_blank', 'rewrite'] },
      { number: 20, title: 'Comparative Adjectives', exercises: ['sentence_reorder', 'fill_blank', 'error_correction'] },
      { number: 21, title: 'Superlative Adjectives', exercises: ['fill_blank', 'multiple_choice', 'sentence_reorder'] },
      { number: 22, title: 'Adverbs of Frequency', exercises: ['sentence_reorder', 'error_correction', 'rewrite'] },
      { number: 23, title: 'Adverbs of Manner', exercises: ['matching', 'fill_blank', 'error_correction'] },
      { number: 24, title: 'Prepositions of Time — at, in, on', exercises: ['fill_blank', 'sort', 'error_correction'] },
      { number: 25, title: 'Prepositions of Place & Movement', exercises: ['matching', 'multiple_choice', 'fill_blank'] },
      { number: 26, title: 'Subject, Object & Possessive Pronouns', exercises: ['rewrite', 'error_correction', 'fill_blank'] },
      { number: 27, title: 'Reflexive Pronouns', exercises: ['fill_blank', 'multiple_choice', 'error_correction'] },
      { number: 28, title: 'Question Forms — Wh- & Yes/No Questions', exercises: ['sentence_reorder', 'rewrite', 'error_correction'] },
      { number: 29, title: 'Conjunctions — and, but, because, so, when, if', exercises: ['matching', 'fill_blank', 'rewrite'] },
      { number: 30, title: 'Conditional Sentences — Zero & First Conditional', exercises: ['matching', 'fill_blank', 'multiple_choice'] },
    ],
    B1: [
      { number: 1,  title: 'Simple Present Tense', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 2,  title: 'Present Continuous', exercises: ['rewrite','matching','multiple_choice'] },
      { number: 3,  title: 'Simple Past Tense', exercises: ['true_false','short_answer','fill_blank'] },
      { number: 4,  title: 'Past Continuous', exercises: ['fill_blank','short_answer','sort'] },
      { number: 5,  title: 'Present Perfect Simple', exercises: ['multiple_choice','short_answer','fill_blank'] },
      { number: 6,  title: 'Present Perfect vs Simple Past', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 7,  title: 'Past Perfect Simple', exercises: ['rewrite','matching','sentence_reorder'] },
      { number: 8,  title: 'Future: Will & Going To', exercises: ['true_false','short_answer','fill_blank'] },
      { number: 9,  title: 'Future Continuous & Future Perfect', exercises: ['fill_blank','short_answer','fill_blank'] },
      { number: 10, title: 'Modal Verbs: Obligation & Necessity', exercises: ['multiple_choice','fill_blank','error_correction'] },
      { number: 11, title: 'Modal Verbs: Ability & Possibility', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 12, title: 'Modal Verbs: Advice & Deduction', exercises: ['rewrite','matching','multiple_choice'] },
      { number: 13, title: 'Passive Voice – Present & Past', exercises: ['true_false','short_answer','fill_blank'] },
      { number: 14, title: 'Passive Voice: Other Tenses & Modals', exercises: ['fill_blank','short_answer','fill_blank'] },
      { number: 15, title: 'Conditional: Zero & First', exercises: ['fill_blank','short_answer','fill_blank'] },
      { number: 16, title: 'The Second Conditional & Wish', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 17, title: 'Unreal Past Situations (Third Conditional)', exercises: ['multiple_choice','rewrite','matching'] },
      { number: 18, title: 'Reported Speech – Statements', exercises: ['true_false','short_answer','fill_blank'] },
      { number: 19, title: 'Reported Speech – Questions & Commands', exercises: ['fill_blank','short_answer','fill_blank'] },
      { number: 20, title: 'Relative Clauses', exercises: ['multiple_choice','fill_blank','fill_blank'] },
      { number: 21, title: 'Gerunds and Infinitives', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 22, title: 'Countable & Uncountable Nouns', exercises: ['rewrite','matching','sort'] },
      { number: 23, title: 'Comparison of Adjectives & Adverbs', exercises: ['true_false','short_answer','fill_blank'] },
      { number: 24, title: 'Phrasal Verbs', exercises: ['fill_blank','short_answer','fill_blank'] },
      { number: 25, title: 'Prepositional Phrases & Collocations', exercises: ['fill_blank','short_answer','fill_blank'] },
      { number: 26, title: 'Question Tags', exercises: ['fill_blank','multiple_choice','error_correction'] },
      { number: 27, title: 'Linkers & Discourse Markers', exercises: ['rewrite','matching','sentence_reorder'] },
      { number: 28, title: 'Determiners & Quantifiers', exercises: ['true_false','short_answer','fill_blank'] },
      { number: 29, title: 'Expressing Wishes & Hypothetical Meaning', exercises: ['fill_blank','fill_blank','sort'] },
      { number: 30, title: 'Mixed Grammar Review & Error Analysis', exercises: ['multiple_choice','multiple_choice','multiple_choice'] },
    ],
    B2: [],
  },
  vocabulary: { A1: [], A2: [], B1: [], B2: [] },
  speaking:   { A1: [], A2: [], B1: [], B2: [] },
};

const TYPE_LABELS = {
  fill_blank: 'Fill in the blank',
  matching: 'Matching',
  sentence_reorder: 'Sentence unjumble',
  multiple_choice: 'Multiple choice',
  rewrite: 'Rewrite',
  short_answer: 'Short answer',
  sort: 'Sort into columns',
  error_correction: 'Error correction',
  true_false: 'True / False',
};

const LEVEL_COLORS = {
  A1: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  A2: 'bg-teal-100 text-teal-700 border-teal-200',
  B1: 'bg-blue-100 text-blue-700 border-blue-200',
  B2: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function ContentLibrary() {
  const [skill, setSkill] = useState('grammar');
  const [level, setLevel] = useState('A1');
  const [uploaded, setUploaded] = useState({}); // key: "skill-level-lessonNum" → true
  const [uploading, setUploading] = useState(null); // lesson number currently uploading
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();
  const pendingLesson = useRef(null);

  // Load what's already uploaded from the database
  useEffect(() => {
    api.listUploadedContent()
      .then(data => {
        const map = {};
        // data.content is grouped by level/skill — mark those as uploaded
        (data.content || []).forEach(row => {
          // We mark the level+skill as having content (per-lesson tracking comes later)
          map[`${row.skill}-${row.level}`] = parseInt(row.count);
        });
        setUploaded(map);
      })
      .catch(() => {});
  }, []);

  const lessons = CATALOGUE[skill]?.[level] || [];
  const uploadedCount = Object.entries(uploaded)
    .filter(([k]) => k.startsWith(`${skill}-${level}`))
    .reduce((s, [,v]) => s + v, 0);

  function openFilePicker(lesson) {
    pendingLesson.current = lesson;
    setError('');
    setUploadResult(null);
    fileRef.current.click();
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    e.target.value = ''; // reset so same file can be re-picked
    if (!file || !pendingLesson.current) return;

    const lesson = pendingLesson.current;
    setUploading(lesson.number);
    setError('');
    setUploadResult(null);

    try {
      const text = await file.text();
      const data = await api.uploadContent(text, level, false);

      setUploadResult({ lesson, ...data.summary });
      // Mark this lesson as uploaded
      setUploaded(u => ({
        ...u,
        [`${skill}-${level}-${lesson.number}`]: true,
        [`${skill}-${level}`]: (u[`${skill}-${level}`] || 0) + data.summary.exercises_inserted,
      }));
    } catch (err) {
      setError(`Lesson ${lesson.number}: ${err.message}`);
    } finally {
      setUploading(null);
      pendingLesson.current = null;
    }
  }

  function isUploaded(lesson) {
    return !!uploaded[`${skill}-${level}-${lesson.number}`];
  }

  const totalLessons = lessons.length;
  const uploadedLessons = lessons.filter(isUploaded).length;
  const progress = totalLessons > 0 ? Math.round((uploadedLessons / totalLessons) * 100) : 0;

  return (
    <div className="p-8 max-w-5xl">
      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept=".txt" className="hidden" onChange={handleFileSelected} />

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Content Library</h1>
        <p className="text-gray-500 mt-1">Upload lesson content and track progress across all levels</p>
      </div>

      {/* Skill + Level selectors */}
      <div className="flex gap-6 mb-6">
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Skill</div>
          <div className="flex gap-2">
            {['grammar', 'vocabulary', 'speaking'].map(s => (
              <button key={s} onClick={() => setSkill(s)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all capitalize
                  ${skill === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'}`}>
                {s === 'grammar' ? '📖' : s === 'vocabulary' ? '🔤' : '🎤'} {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Level</div>
          <div className="flex gap-2">
            {['A1', 'A2', 'B1', 'B2'].map(l => (
              <button key={l} onClick={() => setLevel(l)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all
                  ${level === l ? `${LEVEL_COLORS[l]} border-current` : 'bg-white text-gray-400 border-gray-200 hover:border-indigo-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      {totalLessons > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-gray-700">
              {skill.charAt(0).toUpperCase() + skill.slice(1)} — {level}
            </div>
            <div className="text-sm font-semibold text-gray-900">
              {uploadedLessons} / {totalLessons} lessons uploaded
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-2">{progress}% complete</div>
        </div>
      )}

      {/* Upload result toast */}
      {uploadResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <div className="text-2xl">✅</div>
          <div>
            <div className="font-semibold text-green-800">
              Lesson {uploadResult.lesson.number} uploaded successfully
            </div>
            <div className="text-sm text-green-600 mt-0.5">
              {uploadResult.exercises_inserted} exercises saved · {uploadResult.lessons_found} lesson detected
            </div>
          </div>
          <button onClick={() => setUploadResult(null)} className="ml-auto text-green-400 hover:text-green-600">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Lesson list */}
      {lessons.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📋</div>
          <div className="font-semibold text-gray-600">Syllabus not defined yet</div>
          <div className="text-sm mt-1">Lesson placeholders for {skill} {level} will appear here once added.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {lessons.map(lesson => {
            const done = isUploaded(lesson);
            const isLoading = uploading === lesson.number;
            return (
              <div key={lesson.number}
                className={`bg-white rounded-xl border-2 transition-all p-5
                  ${done ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center gap-4">
                  {/* Lesson number */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0
                    ${done ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                    {done ? '✓' : lesson.number}
                  </div>

                  {/* Title + exercise types */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-semibold ${done ? 'text-green-900' : 'text-gray-900'}`}>
                      Lesson {lesson.number} — {lesson.title}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {lesson.exercises.map((type, i) => (
                        <span key={i}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                          <span className="font-bold text-gray-400">{String.fromCharCode(65 + i)}.</span>
                          {TYPE_LABELS[type] || type}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Upload button */}
                  <div className="shrink-0">
                    {isLoading ? (
                      <div className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600">
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                        Uploading…
                      </div>
                    ) : done ? (
                      <button
                        onClick={() => openFilePicker(lesson)}
                        className="px-4 py-2 text-sm text-green-700 border border-green-300 rounded-lg hover:bg-green-100 transition-colors">
                        ✓ Uploaded · Replace
                      </button>
                    ) : (
                      <button
                        onClick={() => openFilePicker(lesson)}
                        className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">
                        Upload ↑
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
