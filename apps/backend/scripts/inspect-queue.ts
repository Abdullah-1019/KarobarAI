// One-off inspection script — not part of the app.
import '../src/core/config';
import { Queue } from 'bullmq';
import { redis } from '../src/core/redis';

async function main() {
  const queue = new Queue('notifications-pending', { connection: redis });
  const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
  console.log('Job counts:', counts);

  const failed = await queue.getFailed(0, 10);
  for (const job of failed) {
    console.log('FAILED JOB:', { id: job.id, data: job.data, failedReason: job.failedReason });
  }

  const waiting = await queue.getWaiting(0, 10);
  for (const job of waiting) {
    console.log('WAITING JOB:', { id: job.id, data: job.data });
  }

  const completed = await queue.getCompleted(0, 10);
  for (const job of completed) {
    console.log('COMPLETED JOB:', { id: job.id, data: job.data });
  }

  await queue.close();
  redis.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
