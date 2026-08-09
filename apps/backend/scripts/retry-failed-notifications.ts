// One-off inspection/repair script — not part of the app. Retries the notification jobs that
// failed due to the plaintext-email bug (now fixed via fix-seed-user-encryption.ts) so the user
// doesn't have to redo the return flow just to see the notifications that should have fired.
import '../src/core/config';
import { Queue } from 'bullmq';
import { redis } from '../src/core/redis';

async function main() {
  const queue = new Queue('notifications-pending', { connection: redis });
  const failed = await queue.getFailed(0, 50);

  for (const job of failed) {
    console.log(`Retrying job ${job.id} (${job.data.type} -> user ${job.data.userId})`);
    await job.retry();
  }

  console.log(`Retried ${failed.length} job(s).`);
  await queue.close();
  redis.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
