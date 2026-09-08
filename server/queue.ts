import { Queue, Worker } from 'bullmq';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const bgQueue = new Queue('netora-jobs', { connection });

export const worker = new Worker(
  'netora-jobs',
  async (job) => {
    // This is where real job execution logic would go based on job.name and job.data
    // Currently acting as the structural foundation to replace the DB-poller.
    console.log(`[BullMQ Worker] Executing job ${job.id} of type ${job.name}`);
    if (job.name === 'sms_send') {
      // await handleSmsSend(job.data);
    }
  },
  { connection }
);

worker.on('completed', (job) => {
  console.log(`[BullMQ Worker] Job ${job.id} completed successfully`);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ Worker] Job ${job?.id} failed:`, err);
});
