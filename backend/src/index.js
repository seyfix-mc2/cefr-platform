import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { migrate } from './db/pool.js';
import { resolveTenant } from './middleware/tenant.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import teacherRoutes from './routes/teacher.js';
import contentRoutes from './routes/content.js';
import speakingRoutes from './routes/speaking.js';
import assignmentRoutes from './routes/assignments.js';
import progressRoutes from './routes/progress.js';
import { seedIfEmpty } from './db/seed.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(resolveTenant);
app.use('/auth', authRoutes);
app.use('/admin', adminRoutes);
app.use('/teacher', teacherRoutes);
app.use('/content', contentRoutes);
app.use('/speaking', speakingRoutes);
app.use('/assignments', assignmentRoutes);
app.use('/progress', progressRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// Auto-migrate then auto-seed if database is empty, then start
migrate()
  .then(() => seedIfEmpty())
  .then(() => {
    app.listen(PORT, () => console.log(`🎓 CEFR Platform running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Startup failed:', err.message);
    process.exit(1);
  });

export default app;
