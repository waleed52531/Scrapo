import { describe, expect, it } from 'vitest';
import { loadWorkerConfig } from './config';

describe('loadWorkerConfig', () => {
  it('requires Redis and PostgreSQL URLs', () => {
    expect(() => loadWorkerConfig({})).toThrow('REDIS_URL is required');
  });

  it('returns valid configuration', () => {
    expect(loadWorkerConfig({ REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgresql://localhost/db' })).toEqual({
      redisUrl: 'redis://localhost:6379',
      databaseUrl: 'postgresql://localhost/db',
    });
  });
});
