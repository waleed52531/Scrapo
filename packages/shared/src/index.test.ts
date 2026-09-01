import { describe, expect, it } from 'vitest';
import { normalizeCompanyName, normalizeDomain } from './index';

describe('normalization', () => {
  it('normalizes equivalent company domains', () => {
    expect(normalizeDomain('https://www.Example.com/path')).toBe('example.com');
  });

  it('normalizes company names', () => {
    expect(normalizeCompanyName('ABC Digital, Ltd.')).toBe('abc digital ltd');
  });
});
