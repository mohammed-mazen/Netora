import { createClient } from 'redis';

// Initialize Redis client using the environment variable (or a default for local dev)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({ url: redisUrl });

redisClient.on('error', (err: any) => console.error('[Redis] Client Error', err));
redisClient.on('connect', () => console.log('[Redis] Connected to Redis'));

// A helper to ensure the client is connected before use
export async function ensureRedisConnected() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}
