import 'dotenv/config';
import { migrate } from './pool.js';

migrate()
  .then(() => {
    console.log('✓ Database migrated');
    process.exit(0);
  })
  .catch((err) => {
    console.error('✗ Migration failed:', err.message);
    process.exit(1);
  });
