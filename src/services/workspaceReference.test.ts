/**
 * workspaceReference.ts 单元测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  parseWorkspaceReferences,
  getWorkspaceByName,
  isValidWorkspaceReference,
  buildWorkspaceContextExtra,
  buildSystemPrompt,
} from './workspaceReference';
import type { Workspace } from '../types';

// Mock i18next
vi.mock('i18next', () => ({
  default: {
    t: vi.fn((key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'systemPrompt:workingIn': `正在工作区 ${params?.name || ''} 中工作`,
        'systemPrompt:projectPath': `项目路径: ${params?.path || ''}`,
        'systemPrompt:fileRefSyntax': '文件引用语法: @filename 或 @dir/filename',
        'systemPrompt:contextWorkspaces': '关联工作区:',
        'systemPrompt:refSyntax': `引用语法: @${params?.name || ''}:filename`,
        'systemPrompt:todoManagement': '待办管理:',
        'systemPrompt:todoStorage': `待办文件存储在: ${params?.path || ''}/.polaris/todos/`,
        'systemPrompt:todoTrigger': '当用户要求添加待办时，使用 todo_write 工具',
        'systemPrompt:todoRead': '使用 todo_read 工具读取当前待办列表',
        'systemPrompt:todoFormat': '待办格式: JSON 数组',
        'systemPrompt:todoParse': '解析时使用 JSON.parse',
      };
      return translations[key] || key;
    }),
    bind: vi.fn((fn) => fn),
  },
}));

// 创建模拟工作区数据
const createMockWorkspace = (id: string, name: string, path: string): Workspace => ({
  id,
  name,
  path,
  createdAt: '2026-01-01T00:00:00Z',
  lastAccessed: '2026-03-19T00:00:00Z',
});

describe('workspaceReference', () => {
  const mockWorkspaces: Workspace[] = [
    createMockWorkspace('ws-1', 'Polaris', 'D:/space/base/Polaris'),
    createMockWorkspace('ws-2', 'Utils', 'D:/space/libs/utils'),
    createMockWorkspace('ws-3', '测试项目', 'D:/space/test/中文路径'),
  ];

  describe('parseWorkspaceReferences', () => {
    it('应解析指定工作区的引用', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/helper.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(1);
      expect(result.references[0].workspaceName).toBe('Utils');
      expect(result.references[0].relativePath).toBe('src/helper.ts');
      expect(result.references[0].absolutePath).toBe('D:/space/libs/utils/src/helper.ts');
    });

    it('应解析当前工作区的引用（@/path 格式）', () => {
      const result = parseWorkspaceReferences(
        '参考 @/src/App.tsx',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(1);
      expect(result.references[0].workspaceName).toBe('Polaris');
      // 注意：@/path 格式的 relativePath 会包含前导斜杠
      expect(result.references[0].relativePath).toBe('/src/App.tsx');
      // 绝对路径会正确拼接
      expect(result.references[0].absolutePath).toBe('D:/space/base/Polaris//src/App.tsx');
    });

    it('应处理多个引用', () => {
      const result = parseWorkspaceReferences(
        '参考 @Utils:src/a.ts 和 @Polaris:src/b.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(2);
      expect(result.references[0].relativePath).toBe('src/a.ts');
      expect(result.references[1].relativePath).toBe('src/b.ts');
    });

    it('应处理中文工作区名', () => {
      const result = parseWorkspaceReferences(
        '查看 @测试项目:readme.md',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(1);
      expect(result.references[0].workspaceName).toBe('测试项目');
    });

    it('应忽略普通 @ 提及（不包含 . 或 /）', () => {
      const result = parseWorkspaceReferences(
        '联系 @user 和 @Utils:src/a.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      // @user 不包含 . 或 /，会被过滤
      expect(result.references).toHaveLength(1);
      expect(result.references[0].relativePath).toBe('src/a.ts');
    });

    it('应处理邮箱地址（包含 .）', () => {
      const result = parseWorkspaceReferences(
        '联系 test@example.com',
        mockWorkspaces,
        [],
        'ws-1'
      );

      // @example.com 会被匹配为当前工作区引用（example.com 包含 .）
      // relativePath 是 example.com
      expect(result.references).toHaveLength(1);
      expect(result.references[0].workspaceName).toBe('Polaris');
      expect(result.references[0].relativePath).toBe('example.com');
    });

    it('应处理空消息', () => {
      const result = parseWorkspaceReferences('', mockWorkspaces, [], 'ws-1');

      expect(result.references).toHaveLength(0);
      expect(result.processedMessage).toBe('');
    });

    it('应处理无引用的消息', () => {
      const result = parseWorkspaceReferences(
        '这是一条普通消息',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(0);
      expect(result.processedMessage).toBe('这是一条普通消息');
    });

    it('应处理不存在的工作区引用', () => {
      const result = parseWorkspaceReferences(
        '查看 @NotExist:src/a.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(0);
    });

    it('应处理无当前工作区的情况', () => {
      const result = parseWorkspaceReferences(
        '参考 @/src/App.tsx',
        mockWorkspaces,
        [],
        null
      );

      // 无当前工作区时，@/ 格式不应被处理
      expect(result.references).toHaveLength(0);
    });

    it('应正确替换为绝对路径', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/helper.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.processedMessage).toBe('查看 @D:/space/libs/utils/src/helper.ts');
    });

    it('应生成上下文头', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/helper.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.contextHeader).toContain('工作区信息');
      expect(result.contextHeader).toContain('当前工作区: Polaris');
      expect(result.contextHeader).toContain('本次引用的工作区');
    });

    it('应包含关联工作区信息', () => {
      const contextWorkspaces = [mockWorkspaces[1]];
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/helper.ts',
        mockWorkspaces,
        contextWorkspaces,
        'ws-1'
      );

      expect(result.contextHeader).toContain('关联工作区');
      expect(result.contextHeader).toContain('Utils');
    });

    it('应处理路径分隔符（Windows 风格）', () => {
      const winWorkspace = createMockWorkspace('ws-win', 'WinProj', 'C:\\Projects\\WinProj');
      const result = parseWorkspaceReferences(
        '查看 @WinProj:src\\main.ts',
        [winWorkspace],
        [],
        'ws-win'
      );

      expect(result.references[0].absolutePath).toContain('WinProj');
    });

    it('应处理路径分隔符（Unix 风格）', () => {
      const unixWorkspace = createMockWorkspace('ws-unix', 'UnixProj', '/home/user/UnixProj');
      const result = parseWorkspaceReferences(
        '查看 @UnixProj:src/main.ts',
        [unixWorkspace],
        [],
        'ws-unix'
      );

      expect(result.references[0].absolutePath).toBe('/home/user/UnixProj/src/main.ts');
    });

    it('应正确记录原始文本', () => {
      const result = parseWorkspaceReferences(
        '参考 @Utils:src/helper.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].originalText).toBe('@Utils:src/helper.ts');
    });

    it('应处理多个相同工作区的引用', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/a.ts 和 @Utils:src/b.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(2);
      expect(result.references[0].workspaceName).toBe('Utils');
      expect(result.references[1].workspaceName).toBe('Utils');
    });
  });

  describe('getWorkspaceByName', () => {
    it('应正确查找工作区', () => {
      const result = getWorkspaceByName('Utils', mockWorkspaces);
      expect(result?.id).toBe('ws-2');
    });

    it('应大小写不敏感', () => {
      const result = getWorkspaceByName('utils', mockWorkspaces);
      expect(result?.id).toBe('ws-2');
    });

    it('应处理中文名', () => {
      const result = getWorkspaceByName('测试项目', mockWorkspaces);
      expect(result?.id).toBe('ws-3');
    });

    it('应返回 undefined 当不存在时', () => {
      const result = getWorkspaceByName('NotExist', mockWorkspaces);
      expect(result).toBeUndefined();
    });

    it('应处理空数组', () => {
      const result = getWorkspaceByName('Utils', []);
      expect(result).toBeUndefined();
    });
  });

  describe('isValidWorkspaceReference', () => {
    it('应返回 true 对于有效格式', () => {
      expect(isValidWorkspaceReference('@Utils:src/a.ts')).toBe(true);
    });

    it('应返回 true 对于中文名', () => {
      expect(isValidWorkspaceReference('@测试项目:readme.md')).toBe(true);
    });

    it('应返回 true 对于带连字符的名', () => {
      expect(isValidWorkspaceReference('@my-project:src/a.ts')).toBe(true);
    });

    it('应返回 false 对于 @/ 格式', () => {
      expect(isValidWorkspaceReference('@/src/a.ts')).toBe(false);
    });

    it('应返回 false 对于普通文本', () => {
      expect(isValidWorkspaceReference('普通文本')).toBe(false);
    });

    it('应返回 false 对于邮箱', () => {
      expect(isValidWorkspaceReference('test@example.com')).toBe(false);
    });

    it('应返回 false 对于空字符串', () => {
      expect(isValidWorkspaceReference('')).toBe(false);
    });
  });

  describe('buildWorkspaceContextExtra', () => {
    it('应构建工作区上下文', () => {
      const result = buildWorkspaceContextExtra(mockWorkspaces, [], 'ws-1');

      expect(result).not.toBeNull();
      expect(result?.currentWorkspace.name).toBe('Polaris');
      expect(result?.currentWorkspace.path).toBe('D:/space/base/Polaris');
      expect(result?.contextWorkspaces).toEqual([]);
    });

    it('应包含关联工作区', () => {
      const contextWorkspaces = [mockWorkspaces[1]];
      const result = buildWorkspaceContextExtra(mockWorkspaces, contextWorkspaces, 'ws-1');

      expect(result?.contextWorkspaces).toHaveLength(1);
      expect(result?.contextWorkspaces[0].name).toBe('Utils');
    });

    it('应返回 null 当无当前工作区时', () => {
      const result = buildWorkspaceContextExtra(mockWorkspaces, [], null);
      expect(result).toBeNull();
    });

    it('应返回 null 当当前工作区不存在时', () => {
      const result = buildWorkspaceContextExtra(mockWorkspaces, [], 'not-exist');
      expect(result).toBeNull();
    });

    it('应处理多个关联工作区', () => {
      const contextWorkspaces = [mockWorkspaces[1], mockWorkspaces[2]];
      const result = buildWorkspaceContextExtra(mockWorkspaces, contextWorkspaces, 'ws-1');

      expect(result?.contextWorkspaces).toHaveLength(2);
    });
  });

  describe('buildSystemPrompt', () => {
    it('应构建系统提示词', () => {
      const result = buildSystemPrompt(mockWorkspaces, [], 'ws-1');

      expect(result).toContain('正在工作区 Polaris 中工作');
      expect(result).toContain('项目路径: D:/space/base/Polaris');
      expect(result).toContain('文件引用语法');
    });

    it('应包含关联工作区信息', () => {
      const contextWorkspaces = [mockWorkspaces[1]];
      const result = buildSystemPrompt(mockWorkspaces, contextWorkspaces, 'ws-1');

      expect(result).toContain('关联工作区');
      expect(result).toContain('Utils');
    });

    it('应包含待办管理信息', () => {
      const result = buildSystemPrompt(mockWorkspaces, [], 'ws-1');

      expect(result).toContain('待办管理');
      expect(result).toContain('todo_write');
      expect(result).toContain('todo_read');
    });

    it('应返回空字符串当无当前工作区时', () => {
      const result = buildSystemPrompt(mockWorkspaces, [], null);
      expect(result).toBe('');
    });

    it('应返回空字符串当当前工作区不存在时', () => {
      const result = buildSystemPrompt(mockWorkspaces, [], 'not-exist');
      expect(result).toBe('');
    });
  });

  describe('边界情况', () => {
    it('应处理特殊字符路径', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/[test]/a.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(1);
      expect(result.references[0].relativePath).toBe('src/[test]/a.ts');
    });

    it('应处理空格路径', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/my folder/a.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      // 空格会导致路径中断，因为正则使用 [^\s]
      expect(result.references).toHaveLength(1);
    });

    it('应处理深路径', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:a/b/c/d/e/f.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].relativePath).toBe('a/b/c/d/e/f.ts');
    });

    it('应处理文件扩展名', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:README.md',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].relativePath).toBe('README.md');
    });

    it('应处理无扩展名文件', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/Makefile',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].relativePath).toBe('src/Makefile');
    });

    it('应处理隐藏文件', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:.gitignore',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].relativePath).toBe('.gitignore');
    });

    it('应处理 Unicode 路径', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/中文/文件.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].relativePath).toBe('src/中文/文件.ts');
    });

    it('应处理重复引用', () => {
      const result = parseWorkspaceReferences(
        '查看 @Utils:src/a.ts 和 @Utils:src/a.ts',
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references).toHaveLength(2);
    });

    it('应处理极长路径', () => {
      const longPath = 'a/'.repeat(50) + 'file.ts';
      const result = parseWorkspaceReferences(
        `查看 @Utils:${longPath}`,
        mockWorkspaces,
        [],
        'ws-1'
      );

      expect(result.references[0].relativePath).toBe(longPath);
    });
  });
});
