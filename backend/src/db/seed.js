import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from './pool.js';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('Seeding development data...');

  // 1. School
  const schoolId = uuidv4();
  await query(`
    INSERT INTO schools (id, name, slug, license_key, license_expiry, seats_teachers, seats_students, primary_color)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (slug) DO NOTHING
  `, [schoolId, 'Demo Language School', 'demo', 'DEMO-KEY-2026', '2027-12-31', 10, 200, '#4F46E5']);

  // 2. Admin
  const adminHash = await bcrypt.hash('admin123', 12);
  const adminId = uuidv4();
  await query(`
    INSERT INTO users (id, school_id, role, username, password_hash, display_name)
    VALUES ($1, $2, 'admin', 'admin', $3, 'School Admin')
    ON CONFLICT (school_id, username) DO NOTHING
  `, [adminId, schoolId, adminHash]);

  // 3. Teacher
  const teacherHash = await bcrypt.hash('teacher123', 12);
  const teacherId = uuidv4();
  await query(`
    INSERT INTO users (id, school_id, role, username, password_hash, display_name, created_by)
    VALUES ($1, $2, 'teacher', 'teacher1', $3, 'Ms. Johnson', $4)
    ON CONFLICT (school_id, username) DO NOTHING
  `, [teacherId, schoolId, teacherHash, adminId]);

  // 4. Class
  const classId = uuidv4();
  await query(`
    INSERT INTO classes (id, school_id, teacher_id, name, cefr_level)
    VALUES ($1, $2, $3, 'A2 Morning Class', 'A2')
    ON CONFLICT DO NOTHING
  `, [classId, schoolId, teacherId]);

  // 5. Students
  const studentNames = ['alice', 'bob', 'carla', 'david', 'elena'];
  for (const name of studentNames) {
    const hash = await bcrypt.hash('student123', 12);
    await query(`
      INSERT INTO users (id, school_id, role, username, password_hash, display_name, class_id, cefr_level, created_by)
      VALUES ($1, $2, 'student', $3, $4, $5, $6, 'A2', $7)
      ON CONFLICT (school_id, username) DO NOTHING
    `, [uuidv4(), schoolId, name, hash, name.charAt(0).toUpperCase() + name.slice(1), classId, teacherId]);
  }

  // 6. Sample content items (grammar + vocabulary)
  const contentItems = [
    {
      level: 'A2', skill: 'grammar', type: 'multiple_choice',
      title: 'Present Simple vs Continuous',
      tags: ['present_simple', 'present_continuous'],
      body: {
        instructions: 'Choose the correct verb form.',
        items: [
          {
            id: 1,
            prompt: 'She _____ (work) in London every day.',
            options: ['works', 'is working', 'worked', 'has worked'],
            correct: 0,
            explanation: 'We use present simple for routines and habits.'
          },
          {
            id: 2,
            prompt: 'Look! He _____ (run) very fast.',
            options: ['runs', 'is running', 'ran', 'run'],
            correct: 1,
            explanation: 'We use present continuous for actions happening now.'
          },
          {
            id: 3,
            prompt: 'They _____ (study) for their exam right now.',
            options: ['study', 'studied', 'are studying', 'have studied'],
            correct: 2,
            explanation: 'Right now signals present continuous.'
          }
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
          { id: 1, prompt: 'The meeting is _____ Monday morning.', answer: 'on', explanation: 'Use "on" with days of the week.' },
          { id: 2, prompt: 'We eat dinner _____ 7 pm.', answer: 'at', explanation: 'Use "at" with specific times.' },
          { id: 3, prompt: 'She was born _____ July.', answer: 'in', explanation: 'Use "in" with months.' },
          { id: 4, prompt: 'The party is _____ the weekend.', answer: 'at', explanation: 'Use "at" with "the weekend".' }
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
          { id: 1, text: 'She goes to work by bus every morning.', audio_hint: 'Focus on the verb tense.' },
          { id: 2, text: 'They are having lunch in the park right now.', audio_hint: 'Listen for the continuous form.' }
        ]
      }
    },
    {
      level: 'A2', skill: 'speaking', type: 'read_aloud',
      title: 'Read Aloud: Introductions',
      tags: ['pronunciation', 'introductions'],
      body: {
        instructions: 'Read the following passage aloud clearly and naturally.',
        passage: 'My name is Sarah and I am a teacher. I work at a primary school in the city centre. Every morning I wake up at seven o\'clock and have breakfast before I leave the house. I really enjoy my job because I love working with children.',
        focus_words: ['teacher', 'breakfast', 'centre', 'enjoy', 'children'],
        target_pronunciation: ['centre /ˈsentə/', 'breakfast /ˈbrekfəst/']
      }
    },
    {
      level: 'A1', skill: 'grammar', type: 'sentence_reorder',
      title: 'Sentence Order: Basic Statements',
      tags: ['word_order', 'basic'],
      body: {
        instructions: 'Put the words in the correct order to make a sentence.',
        items: [
          { id: 1, words: ['school', 'goes', 'She', 'to', 'every', 'day'], answer: 'She goes to school every day.' },
          { id: 2, words: ['have', 'I', 'a', 'cat', 'small'], answer: 'I have a small cat.' }
        ]
      }
    }
  ];

  for (const item of contentItems) {
    await query(`
      INSERT INTO content_items (id, level, skill, type, title, tags, body)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [uuidv4(), item.level, item.skill, item.type, item.title, item.tags, JSON.stringify(item.body)]);
  }

  // 7. Game templates
  await query(`
    INSERT INTO game_templates (id, skill, level, mechanic_type, name, config)
    VALUES 
      ($1, 'vocabulary', 'A2', 'matching', 'Word Match', $2),
      ($3, 'grammar', 'A2', 'fill_blank', 'Grammar Fill', $4)
  `, [
    uuidv4(), JSON.stringify({ time_limit: 60, pairs_per_round: 6 }),
    uuidv4(), JSON.stringify({ time_limit: 90, show_hints: true })
  ]);

  console.log('✓ Seed complete');
  console.log('\nDemo credentials:');
  console.log('  Subdomain: demo.yourplatform.com');
  console.log('  Admin:   admin / admin123');
  console.log('  Teacher: teacher1 / teacher123');
  console.log('  Student: alice / student123');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
