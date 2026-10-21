import { createApp } from './app';
import { config, FEATURES } from './config';
import { seed } from './db/seed';
import { startJobs } from './jobs/scheduler';

seed();
if (process.env.NO_JOBS !== '1') startJobs();

createApp().listen(config.port, () => {
  console.log(`${config.clinicName} booking API on http://localhost:${config.port}`);
  console.log(`features: ${JSON.stringify(FEATURES)}`);
});
