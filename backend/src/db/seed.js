import bcrypt from 'bcryptjs';
import { query } from './pool.js';
import { v4 as uuidv4 } from 'uuid';

export async function seedIfEmpty() {
  // Check if any school already exists — if so, skip seeding
  const { rows } = await query('SELECT id FROM schools LIMIT 1');
  if (rows.length > 0) {
    console.log('[seed] Database already has data, skipping seed.');
    return;
  }

  console.log('[seed] Empty database detected, seeding demo data...');

  // 1. School
  const schoolId = uuidv4();
  await query(`
    INSERT INTO schools (id, name, slug, license_key, license_expiry, seats_teachers, seats_students, primary_color)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [schoolId, 'Demo Language School', 'demo', 'DEMO-KEY-2026', '2027-12-31', 10, 200, '#4F46E5']);

  // 2. Admin
  const adminHash = await bcrypt.hash('admin123', 12);
  const adminId = uuidv4();
  await query(`
    INSERT INTO users (id, school_id, role, username, password_hash, display_name)
    VALUES ($1, $2, 'admin', 'admin', $3, 'School Admin')
  `, [adminId, schoolId, adminHash]);

  // 3. Teacher
  const teacherHash = await bcrypt.hash('teacher123', 12);
  const teacherId = uuidv4();
  await query(`
    INSERT INTO users (id, school_id, role, username, password_hash, display_name, created_by)
    VALUES ($1, $2, 'teacher', 'teacher1', $3, 'Ms. Johnson', $4)
  `, [teacherId, schoolId, teacherHash, adminId]);

  // 4. Class
  const classId = uuidv4();
  await query(`
    INSERT INTO classes (id, school_id, teacher_id, name, cefr_level)
    VALUES ($1, $2, $3, 'A2 Morning Class', 'A2')
  `, [classId, schoolId, teacherId]);

  // 5. Students
  for (const name of ['alice', 'bob', 'carla', 'david', 'elena']) {
    const hash = await bcrypt.hash('student123', 12);
    await query(`
      INSERT INTO users (id, school_id, role, username, password_hash, display_name, class_id, cefr_level, created_by)
      VALUES ($1, $2, 'student', $3, $4, $5, $6, 'A2', $7)
    `, [uuidv4(), schoolId, name, hash, name.charAt(0).toUpperCase() + name.slice(1), classId, teacherId]);
  }

  // 6. Sample content items
  const contentItems = [
    {
      level: 'A2', skill: 'grammar', type: 'multiple_choice',
      title: 'Present Simple vs Continuous',
      tags: ['present_simple', 'present_continuous'],
      body: {
        instructions: 'Choose the correct verb form.',
        items: [
          { id: 1, prompt: 'She _____ (work) in London every day.', options: ['works', 'is working', 'worked', 'has worked'], correct: 0, explanation: 'We use present simple for routines.' },
          { id: 2, prompt: 'Look! He _____ (run) very fast.', options: ['runs', 'is running', 'ran', 'run'], correct: 1, explanation: 'We use present continuous for actions happening now.' },
          { id: 3, prompt: 'They _____ (study) for their exam right now.', options: ['study', 'studied', 'are studying', 'have studied'], correct: 2, explanation: 'Right now signals present continuous.' }
        ]
      }
    },
    {
      level: 'A2', skill: 'vocabulary', type: 'matching',
      title: 'Daily Routines Vocabulary',
      tags: ['daily_routines', 'verbs'],
      body: {
        instructions: 'Match each word with its definition.',
        items: [
          { id: 1, term: 'commute', definition: 'Travel regularly between home and work' },
          { id: 2, term: 'errand', definition: 'A short trip to do a specific task' },
          { id: 3, term: 'routine', definition: 'A regular sequence of activities' },
          { id: 4, term: 'schedule', definition: 'A plan showing when events will happen' }
        ]
      }
    },
    {
      level: 'A2', skill: 'grammar', type: 'fill_blank',
      title: 'Prepositions of Time',
      tags: ['prepositions', 'time'],
      body: {
        instructions: 'Fill in the blank with the correct preposition: in, on, or at.',
        items: [
          { id: 1, prompt: 'The meeting is _____ Monday morning.', answer: 'on', explanation: 'Use "on" with days.' },
          { id: 2, prompt: 'We eat dinner _____ 7 pm.', answer: 'at', explanation: 'Use "at" with times.' },
          { id: 3, prompt: 'She was born _____ July.', answer: 'in', explanation: 'Use "in" with months.' }
        ]
      }
    },
    {
      level: 'A2', skill: 'speaking', type: 'dictation',
      title: 'Daily Life Dictation 1',
      tags: ['listening', 'daily_life'],
      body: {
        instructions: 'Listen to the sentence and type what you hear.',
        sentences: [
          { id: 1, text: 'She goes to work by bus every morning.' },
          { id: 2, text: 'They are having lunch in the park right now.' }
        ]
      }
    },
    {
      level: 'A2', skill: 'speaking', type: 'read_aloud',
      title: 'Read Aloud: Introductions',
      tags: ['pronunciation', 'introductions'],
      body: {
        instructions: 'Read the following passage aloud clearly and naturally.',
        passage: "My name is Sarah and I am a teacher. I work at a primary school in the city centre. Every morning I wake up at seven o'clock and have breakfast before I leave the house.",
        focus_words: ['teacher', 'breakfast', 'centre', 'enjoy', 'children']
      }
    }
  ];

  for (const item of contentItems) {
    await query(`
      INSERT INTO content_items (id, level, skill, type, title, tags, body)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [uuidv4(), item.level, item.skill, item.type, item.title, item.tags, JSON.stringify(item.body)]);
  }

  console.log('[seed] ✓ Demo data created.');
  console.log('[seed] Login credentials:');
  console.log('[seed]   Admin:   admin / admin123');
  console.log('[seed]   Teacher: teacher1 / teacher123');
  console.log('[seed]   Student: alice / student123');
}

// Allow running directly: node src/db/seed.js
if (process.argv[1].includes('seed.js')) {
  import('./pool.js').then(({ default: pool }) => {
    seedIfEmpty().then(() => pool.end()).catch(err => { console.error(err); process.exit(1); });
  });
}
