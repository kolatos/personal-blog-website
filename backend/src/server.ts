import app from '../../api/app.js';
import { startCleanupJob } from './jobs/cleanupBlacklist.js';

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on port ${PORT}`);

  // Mulai cronjob pembersihan token blacklist
  startCleanupJob();
});
