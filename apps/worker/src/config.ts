export function loadWorkerConfig(environment: NodeJS.ProcessEnv = process.env) {
  const redisUrl = environment.REDIS_URL;
  const databaseUrl = environment.DATABASE_URL;
  if (!redisUrl) throw new Error('REDIS_URL is required.');
  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  return { redisUrl, databaseUrl };
}
