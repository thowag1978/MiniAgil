import { describe, expect, it } from 'vitest';
import { parseCodeLink, parseRepositoryInput } from '../src/services/codeLinks';

describe('GitHub code link validation', () => {
  it('normalizes a project repository without requiring a token', () => {
    expect(parseRepositoryInput({ owner: 'openai', repository: 'miniagil.git', default_branch: 'develop' })).toEqual({ owner: 'openai', repository: 'miniagil', default_branch: 'develop' });
  });
  it('accepts an issue URL whose repository and number match', () => {
    expect(parseCodeLink({ type: 'ISSUE', external_number: 42, url: 'https://github.com/openai/miniagil/issues/42', state: 'OPEN' }, { owner: 'openai', repository: 'miniagil' })).toEqual(expect.objectContaining({ link_type: 'ISSUE', external_number: 42, state: 'OPEN' }));
  });
  it('rejects another repository and mismatched pull request numbers', () => {
    expect(() => parseCodeLink({ type: 'ISSUE', external_number: 42, url: 'https://github.com/other/repo/issues/42' }, { owner: 'openai', repository: 'miniagil' })).toThrow('does not belong');
    expect(() => parseCodeLink({ type: 'PULL_REQUEST', external_number: 8, url: 'https://github.com/openai/miniagil/pull/9' }, { owner: 'openai', repository: 'miniagil' })).toThrow('must match');
  });
  it('validates commit and branch URL shapes', () => {
    expect(parseCodeLink({ type: 'COMMIT', url: 'https://github.com/openai/miniagil/commit/abcdef1234567' }, { owner: 'openai', repository: 'miniagil' }).link_type).toBe('COMMIT');
    expect(parseCodeLink({ type: 'BRANCH', url: 'https://github.com/openai/miniagil/tree/feature/login' }, { owner: 'openai', repository: 'miniagil' }).branch).toBe('feature/login');
  });
});
