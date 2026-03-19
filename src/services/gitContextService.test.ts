/**
 * Git 上下文服务测试
 *
 * 测试覆盖：
 * - getGitCommits: 获取 Git 提交历史
 * - getGitCommit: 获取单个提交详情
 * - getGitDiffStats: 获取 Git 差异统计
 * - getGitStatus: 获取 Git 状态
 * - searchGitCommits: 搜索 Git 提交
 * - createCommitChip: 创建提交上下文芯片
 * - createDiffChip: 创建差异上下文芯片
 * - formatRelativeTime: 格式化相对时间
 * - isInGitRepo: 检查是否在 Git 仓库中
 * - GitServiceError: 自定义错误类
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  getGitCommits,
  getGitCommit,
  getGitDiffStats,
  getGitStatus,
  searchGitCommits,
  createCommitChip,
  createDiffChip,
  formatRelativeTime,
  isInGitRepo,
  GitServiceError,
  type GitCommit,
  type GitDiffStats,
  type GitStatus,
} from './gitContextService';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock logger to suppress console output in tests
vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('gitContextService', () => {
  const mockInvoke = vi.mocked(invoke);
  const testWorkDir = '/test/workspace';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GitServiceError', () => {
    it('should create error with message', () => {
      const error = new GitServiceError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('GitServiceError');
      expect(error.code).toBeUndefined();
    });

    it('should create error with message and code', () => {
      const error = new GitServiceError('Test error', 'GIT_001');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('GIT_001');
    });

    it('should be instance of Error', () => {
      const error = new GitServiceError('Test error');
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('getGitCommits', () => {
    const mockCommits: GitCommit[] = [
      {
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        message: 'feat: add new feature',
        author: 'John Doe',
        timestamp: Date.now() - 3600000,
      },
      {
        hash: 'def456abc789123',
        shortHash: 'def456a',
        message: 'fix: fix bug',
        author: 'Jane Smith',
        timestamp: Date.now() - 7200000,
      },
    ];

    it('should get commits with default options', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await getGitCommits(testWorkDir);

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_commits', {
        dir: testWorkDir,
        limit: 20,
        offset: 0,
        branch: undefined,
        author: undefined,
        since: undefined,
      });
      expect(result).toEqual(mockCommits);
    });

    it('should get commits with custom options', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await getGitCommits(testWorkDir, {
        limit: 50,
        offset: 10,
        branch: 'main',
        author: 'John Doe',
        since: '2024-01-01',
      });

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_commits', {
        dir: testWorkDir,
        limit: 50,
        offset: 10,
        branch: 'main',
        author: 'John Doe',
        since: '2024-01-01',
      });
      expect(result).toEqual(mockCommits);
    });

    it('should return empty array on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Git error'));

      const result = await getGitCommits(testWorkDir);

      expect(result).toEqual([]);
    });

    it('should return empty array when invoke returns null', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const result = await getGitCommits(testWorkDir);

      expect(result).toBeNull();
    });
  });

  describe('getGitCommit', () => {
    const mockCommits: GitCommit[] = [
      {
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        message: 'feat: add new feature',
        author: 'John Doe',
        timestamp: 1000000,
      },
      {
        hash: 'def456abc789123',
        shortHash: 'def456a',
        message: 'fix: fix bug',
        author: 'Jane Smith',
        timestamp: 2000000,
      },
    ];

    it('should find commit by full hash', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await getGitCommit(testWorkDir, 'abc123def456789');

      expect(result).toEqual(mockCommits[0]);
    });

    it('should find commit by short hash', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await getGitCommit(testWorkDir, 'def456a');

      expect(result).toEqual(mockCommits[1]);
    });

    it('should return null when commit not found', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await getGitCommit(testWorkDir, 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Git error'));

      const result = await getGitCommit(testWorkDir, 'abc123');

      expect(result).toBeNull();
    });
  });

  describe('getGitDiffStats', () => {
    const mockStats: GitDiffStats = {
      additions: 10,
      deletions: 5,
      modifications: 3,
      files: ['src/file1.ts', 'src/file2.ts'],
    };

    it('should get diff stats with default options', async () => {
      mockInvoke.mockResolvedValueOnce(mockStats);

      const result = await getGitDiffStats(testWorkDir);

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_diff_stats', {
        dir: testWorkDir,
        staged: false,
        targetHash: undefined,
        sourceHash: undefined,
      });
      expect(result).toEqual(mockStats);
    });

    it('should get staged diff stats', async () => {
      mockInvoke.mockResolvedValueOnce(mockStats);

      const result = await getGitDiffStats(testWorkDir, { staged: true });

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_diff_stats', {
        dir: testWorkDir,
        staged: true,
        targetHash: undefined,
        sourceHash: undefined,
      });
      expect(result).toEqual(mockStats);
    });

    it('should get diff stats between commits', async () => {
      mockInvoke.mockResolvedValueOnce(mockStats);

      const result = await getGitDiffStats(testWorkDir, {
        targetHash: 'abc123',
        sourceHash: 'def456',
      });

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_diff_stats', {
        dir: testWorkDir,
        staged: false,
        targetHash: 'abc123',
        sourceHash: 'def456',
      });
      expect(result).toEqual(mockStats);
    });

    it('should return null on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Git error'));

      const result = await getGitDiffStats(testWorkDir);

      expect(result).toBeNull();
    });
  });

  describe('getGitStatus', () => {
    const mockStatus: GitStatus = {
      branch: 'main',
      staged: ['src/file1.ts'],
      unstaged: ['src/file2.ts'],
      untracked: ['src/file3.ts'],
    };

    it('should get git status', async () => {
      mockInvoke.mockResolvedValueOnce(mockStatus);

      const result = await getGitStatus(testWorkDir);

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_status', {
        dir: testWorkDir,
      });
      expect(result).toEqual(mockStatus);
    });

    it('should return null on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Git error'));

      const result = await getGitStatus(testWorkDir);

      expect(result).toBeNull();
    });
  });

  describe('searchGitCommits', () => {
    const mockCommits: GitCommit[] = [
      {
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        message: 'feat: add new feature',
        author: 'John Doe',
        timestamp: 1000000,
      },
      {
        hash: 'def456abc789123',
        shortHash: 'def456a',
        message: 'fix: fix bug in module',
        author: 'Jane Smith',
        timestamp: 2000000,
      },
      {
        hash: '123abc456def789',
        shortHash: '123abc4',
        message: 'docs: update README',
        author: 'John Doe',
        timestamp: 3000000,
      },
    ];

    it('should search by message', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await searchGitCommits(testWorkDir, 'feature');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('feat: add new feature');
    });

    it('should search by hash', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await searchGitCommits(testWorkDir, 'abc123d');

      expect(result).toHaveLength(1);
      expect(result[0].shortHash).toBe('abc123d');
    });

    it('should search by author', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await searchGitCommits(testWorkDir, 'John');

      expect(result).toHaveLength(2);
      expect(result.every(c => c.author.includes('John'))).toBe(true);
    });

    it('should be case insensitive', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await searchGitCommits(testWorkDir, 'FEATURE');

      expect(result).toHaveLength(1);
      expect(result[0].message).toBe('feat: add new feature');
    });

    it('should search by full hash prefix', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await searchGitCommits(testWorkDir, 'abc123');

      expect(result).toHaveLength(1);
      expect(result[0].shortHash).toBe('abc123d');
    });

    it('should return empty array when no matches', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      const result = await searchGitCommits(testWorkDir, 'nonexistent');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Git error'));

      const result = await searchGitCommits(testWorkDir, 'test');

      expect(result).toEqual([]);
    });

    it('should respect custom limit option', async () => {
      mockInvoke.mockResolvedValueOnce(mockCommits);

      await searchGitCommits(testWorkDir, 'test', { limit: 100 });

      expect(mockInvoke).toHaveBeenCalledWith('plugin:git|get_commits', {
        dir: testWorkDir,
        limit: 100,
        offset: 0,
        branch: undefined,
        author: undefined,
        since: undefined,
      });
    });
  });

  describe('createCommitChip', () => {
    it('should create commit chip from commit', () => {
      const commit: GitCommit = {
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        message: 'feat: add new feature',
        author: 'John Doe',
        timestamp: 1000000,
      };

      const chip = createCommitChip(commit);

      expect(chip).toEqual({
        type: 'commit',
        hash: 'abc123def456789',
        shortHash: 'abc123d',
        message: 'feat: add new feature',
        author: 'John Doe',
        timestamp: 1000000,
      });
    });
  });

  describe('createDiffChip', () => {
    it('should create diff chip for staged changes', () => {
      const chip = createDiffChip('staged');

      expect(chip).toEqual({
        type: 'diff',
        target: 'staged',
        targetHash: undefined,
        fileCount: undefined,
        stats: undefined,
      });
    });

    it('should create diff chip for unstaged changes', () => {
      const chip = createDiffChip('unstaged');

      expect(chip).toEqual({
        type: 'diff',
        target: 'unstaged',
        targetHash: undefined,
        fileCount: undefined,
        stats: undefined,
      });
    });

    it('should create diff chip for commit with stats', () => {
      const stats: GitDiffStats = {
        additions: 10,
        deletions: 5,
        modifications: 3,
        files: ['file1.ts', 'file2.ts'],
      };

      const chip = createDiffChip('commit', stats, 'abc123');

      expect(chip).toEqual({
        type: 'diff',
        target: 'commit',
        targetHash: 'abc123',
        fileCount: 2,
        stats: {
          additions: 10,
          deletions: 5,
          modifications: 3,
        },
      });
    });

    it('should create diff chip without stats', () => {
      const chip = createDiffChip('staged');

      expect(chip.fileCount).toBeUndefined();
      expect(chip.stats).toBeUndefined();
    });
  });

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-03-19T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return "刚刚" for less than 60 seconds', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 30000);
      expect(result).toBe('刚刚');
    });

    it('should return minutes ago for less than 60 minutes', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 1800000); // 30 minutes
      expect(result).toBe('30 分钟前');
    });

    it('should return hours ago for less than 24 hours', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 7200000); // 2 hours
      expect(result).toBe('2 小时前');
    });

    it('should return days ago for less than 7 days', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 172800000); // 2 days
      expect(result).toBe('2 天前');
    });

    it('should return date for 7 days or more', () => {
      const result = formatRelativeTime(new Date('2024-03-10').getTime());
      expect(result).toMatch(/3月/);
      expect(result).toMatch(/10/);
    });

    it('should handle 1 minute edge case', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 60000);
      expect(result).toBe('1 分钟前');
    });

    it('should handle 1 hour edge case', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 3600000);
      expect(result).toBe('1 小时前');
    });

    it('should handle 1 day edge case', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 86400000);
      expect(result).toBe('1 天前');
    });

    it('should handle 6 days edge case', () => {
      const now = Date.now();
      const result = formatRelativeTime(now - 518400000); // 6 days
      expect(result).toBe('6 天前');
    });
  });

  describe('isInGitRepo', () => {
    it('should return true when in git repo', async () => {
      const mockStatus: GitStatus = {
        branch: 'main',
        staged: [],
        unstaged: [],
        untracked: [],
      };
      mockInvoke.mockResolvedValueOnce(mockStatus);

      const result = await isInGitRepo(testWorkDir);

      expect(result).toBe(true);
    });

    it('should return false when not in git repo', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Not a git repo'));

      const result = await isInGitRepo(testWorkDir);

      expect(result).toBe(false);
    });

    it('should return false when status is null', async () => {
      mockInvoke.mockResolvedValueOnce(null);

      const result = await isInGitRepo(testWorkDir);

      expect(result).toBe(false);
    });

    it('should return true for repo with no changes', async () => {
      const mockStatus: GitStatus = {
        branch: 'main',
        staged: [],
        unstaged: [],
        untracked: [],
      };
      mockInvoke.mockResolvedValueOnce(mockStatus);

      const result = await isInGitRepo(testWorkDir);

      expect(result).toBe(true);
    });
  });
});
