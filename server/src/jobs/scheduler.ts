import { expireHolds } from './expireHolds';
import { markNoShows } from './markNoShows';
import { sendReminders } from './sendReminders';
import { expireOffers } from '../services/waitlistService';

const MINUTE = 60_000;

const jobs = [
  { name: 'expire-holds', everyMs: MINUTE, run: expireHolds },
  { name: 'mark-no-shows', everyMs: 5 * MINUTE, run: markNoShows },
  { name: 'send-reminders', everyMs: 15 * MINUTE, run: sendReminders },
  { name: 'expire-waitlist-offers', everyMs: MINUTE, run: expireOffers },
];

export function startJobs() {
  for (const job of jobs) {
    const tick = async () => {
      try {
        await job.run();
      } catch (e) {
        console.error(`[job:${job.name}] failed`, e);
      }
    };
    setInterval(tick, job.everyMs);
    void tick();
  }
  console.log(`[jobs] started ${jobs.map((j) => j.name).join(', ')}`);
}
