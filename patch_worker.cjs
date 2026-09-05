const fs = require('fs');
const content = fs.readFileSync('server/worker/backgroundJobWorker.ts', 'utf-8');

// 1. Add sql import and VISIBILITY_TIMEOUT_MS
let newContent = content.replace(
  'import { and, asc, eq, lt, lte, or } from "drizzle-orm";',
  'import { and, asc, eq, lt, lte, or, sql } from "drizzle-orm";'
);

newContent = newContent.replace(
  'const MAX_ATTEMPTS = 5;',
  'const MAX_ATTEMPTS = 5;\nconst VISIBILITY_TIMEOUT_MS = 5 * 60 * 1000;'
);

// 2. Rewrite claimNextJob
const oldClaimFn = `export async function claimNextJob(): Promise<Job | null> {
  const db = await getDb();
  if (!db) return null;

  // Deterministic FIFO ordering (oldest-created first) — without this, MySQL
  // gives no guaranteed row order for an unordered SELECT, so under load
  // (many due jobs from different tenants/tests) claimNextJob could pick an
  // arbitrary eligible row instead of the actual longest-waiting one, which
  // both starves old jobs and made test assertions non-deterministic when
  // the shared dev DB had other due rows left over from earlier tests.
  const candidates = await db
    .select()
    .from(backgroundJobs)
    .where(
      or(
        eq(backgroundJobs.status, "queued"),
        and(eq(backgroundJobs.status, "retrying"), lte(backgroundJobs.nextRetryAt, new Date())),
      ),
    )
    .orderBy(asc(backgroundJobs.createdAt), asc(backgroundJobs.id))
    .limit(1);

  const job = candidates[0];
  if (!job) return null;

  const nextAttempts = job.attempts + 1;
  await db.update(backgroundJobs).set({ status: "running", attempts: nextAttempts }).where(eq(backgroundJobs.id, job.id));
  // Return the post-update snapshot (not the pre-update row) so callers
  // (executeJob's retry/max-attempts logic) see the correct attempts count.
  return { ...job, status: "running", attempts: nextAttempts };
}`;

const newClaimFn = `export async function claimNextJob(): Promise<Job | null> {
  const db = await getDb();
  if (!db) return null;

  const now = new Date();
  const visibilityCutoff = new Date(Date.now() - VISIBILITY_TIMEOUT_MS);

  // We use a transaction to atomically select and update the job to 'running'
  return await db.transaction(async tx => {
    // Select the oldest eligible job.
    // We include jobs stuck in 'running' state past the visibility timeout.
    // 'FOR UPDATE SKIP LOCKED' prevents multiple workers from waiting on the same row,
    // they just skip it and grab the next available one.
    const query = sql\`
      SELECT * FROM \${backgroundJobs}
      WHERE (
        status = 'queued'
        OR (status = 'retrying' AND nextRetryAt <= \${now})
        OR (status = 'running' AND updatedAt <= \${visibilityCutoff})
      )
      ORDER BY createdAt ASC, id ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    \`;

    const candidates = await tx.execute(query);
    const rows = candidates[0] as unknown as Job[];
    const job = rows[0];

    if (!job) return null;

    const nextAttempts = job.status === 'running' ? job.attempts : job.attempts + 1;
    await tx.update(backgroundJobs).set({
      status: "running",
      attempts: nextAttempts,
      updatedAt: new Date() // reset visibility timer
    }).where(eq(backgroundJobs.id, job.id));

    return { ...job, status: "running", attempts: nextAttempts };
  });
}`;

newContent = newContent.replace(oldClaimFn, newClaimFn);

fs.writeFileSync('server/worker/backgroundJobWorker.ts', newContent, 'utf-8');
console.log('Worker patched.');
