import { useState, useRef } from 'react';
import { api } from '../lib/api.js';

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

function Card({ children, className = "" }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>;
}

function Button({ children, onClick, variant = "primary", disabled = false, className = "" }) {
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300",
    secondary: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${variants[variant]} disabled:cursor-not-allowed ${className}`}
    >
      {children}
    </button>
  );
}

export default function ContentUpload() {
  const [level, setLevel] = useState('A1');
  const [file, setFile] = useState(null);
  const [fileText, setFileText] = useState('');
  const [step, setStep] = useState('select'); // select | preview | uploading | done | error
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const fileRef = useRef();

  async function handleFile(f) {
    if (!f) return;
    setFile(f);
    const text = await f.text();
    setFileText(text);
    setError('');
  }

  function onDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.txt')) handleFile(f);
    else setError('Please drop a .txt file.');
  }

  async function handlePreview() {
    setError('');
    setStep('previewing');
    try {
      const data = await api.post('/upload/content/preview', { text: fileText, level });
      setPreview(data.lessons);
      setStep('preview');
    } catch (err) {
      setError(err.message);
      setStep('select');
    }
  }

  async function handleUpload() {
    setStep('uploading');
    setError('');
    try {
      const data = await api.post('/upload/content', { text: fileText, level, replace });
      setResult(data);
      setStep('done');
    } catch (err) {
      setError(err.message);
      setStep('preview');
    }
  }

  function reset() {
    setFile(null);
    setFileText('');
    setPreview(null);
    setResult(null);
    setError('');
    setStep('select');
    setReplace(false);
  }

  const typeLabels = {
    fill_blank: 'Fill in the blank',
    matching: 'Matching',
    sentence_reorder: 'Sentence unjumble',
    multiple_choice: 'Multiple choice',
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Upload Content</h1>
        <p className="text-gray-500 mt-1">Upload your grammar exercises as a .txt file</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-8 text-sm">
        {['Select file', 'Preview', 'Upload'].map((s, i) => {
          const stepNum = i + 1;
          const currentStep = step === 'select' || step === 'previewing' ? 1 : step === 'preview' ? 2 : 3;
          const done = currentStep > stepNum;
          const active = currentStep === stepNum;
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {done ? '✓' : stepNum}
              </div>
              <span className={active ? 'font-medium text-gray-900' : 'text-gray-400'}>{s}</span>
              {i < 2 && <span className="text-gray-300">→</span>}
            </div>
          );
        })}
      </div>

      {/* STEP 1: SELECT */}
      {(step === 'select' || step === 'previewing') && (
        <Card className="p-6 space-y-5">
          {/* Level selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CEFR Level</label>
            <div className="flex gap-3">
              {['A1', 'A2', 'B1', 'B2'].map(l => (
                <button key={l}
                  onClick={() => setLevel(l)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all
                    ${level === l ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* File drop zone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content file (.txt)</label>
            <div
              onDrop={onDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50'}`}
            >
              <input ref={fileRef} type="file" accept=".txt" className="hidden"
                onChange={e => handleFile(e.target.files[0])} />
              {file ? (
                <div>
                  <div className="text-3xl mb-2">📄</div>
                  <div className="font-medium text-green-700">{file.name}</div>
                  <div className="text-xs text-green-600 mt-1">{(file.size / 1024).toFixed(1)} KB — Click to change</div>
                </div>
              ) : (
                <div>
                  <div className="text-4xl mb-3">📂</div>
                  <div className="font-medium text-gray-700">Drop your .txt file here</div>
                  <div className="text-sm text-gray-400 mt-1">or click to browse</div>
                </div>
              )}
            </div>
          </div>

          {/* Replace option */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded" />
            <div>
              <div className="text-sm font-medium text-gray-700">Replace existing {level} grammar content</div>
              <div className="text-xs text-gray-400">If unchecked, new content is added alongside existing content</div>
            </div>
          </label>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {error}</p>}

          <Button onClick={handlePreview} disabled={!file || step === 'previewing'} className="w-full justify-center">
            {step === 'previewing' ? 'Parsing file…' : 'Preview content →'}
          </Button>
        </Card>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 'preview' && preview && (
        <div className="space-y-4">
          <Card className="p-5 bg-blue-50 border-blue-200">
            <div className="text-sm font-medium text-blue-800 mb-1">
              ✓ Parsed successfully — {preview.length} lesson{preview.length !== 1 ? 's' : ''} found
            </div>
            <div className="text-xs text-blue-600">
              Review below, then click Upload to save to the database.
            </div>
          </Card>

          {preview.map(lesson => (
            <Card key={lesson.number} className="overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-gray-900">Lesson {lesson.number}</span>
                  <span className="text-gray-500 ml-2 text-sm">{lesson.title}</span>
                </div>
                <Badge color="indigo">{lesson.exercises.length} exercises</Badge>
              </div>
              <div className="divide-y divide-gray-50">
                {lesson.exercises.map((ex, i) => (
                  <div key={i} className="px-5 py-3 flex items-start gap-4">
                    <div className="text-xs text-gray-400 w-20 shrink-0 pt-0.5">{typeLabels[ex.type] || ex.type}</div>
                    <div className="flex-1">
                      <div className="text-sm text-gray-700">{ex.title}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{ex.item_count} questions</div>
                      {ex.sample && (
                        <div className="mt-2 text-xs bg-gray-50 rounded p-2 text-gray-500 italic">
                          Sample: {ex.sample.prompt || (ex.sample.words ? ex.sample.words.join(' / ') : ex.sample.term)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠️ {error}</p>}

          <div className="flex gap-3">
            <Button onClick={handleUpload} className="flex-1 justify-center">
              ✓ Upload {preview.reduce((s, l) => s + l.exercises.length, 0)} exercises to database
            </Button>
            <Button variant="secondary" onClick={() => setStep('select')}>← Back</Button>
          </div>
        </div>
      )}

      {/* STEP 3: UPLOADING */}
      {step === 'uploading' && (
        <Card className="p-16 text-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-medium text-gray-700">Saving to database…</p>
        </Card>
      )}

      {/* DONE */}
      {step === 'done' && result && (
        <Card className="p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Content uploaded successfully!</h2>
          <div className="flex justify-center gap-6 my-6 text-center">
            <div>
              <div className="text-3xl font-bold text-indigo-600">{result.summary.lessons_found}</div>
              <div className="text-xs text-gray-500 mt-1">Lessons</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600">{result.summary.exercises_inserted}</div>
              <div className="text-xs text-gray-500 mt-1">Exercises saved</div>
            </div>
            {result.summary.errors > 0 && (
              <div>
                <div className="text-3xl font-bold text-red-500">{result.summary.errors}</div>
                <div className="text-xs text-gray-500 mt-1">Errors</div>
              </div>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <Button onClick={reset}>Upload another file</Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>Done</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
