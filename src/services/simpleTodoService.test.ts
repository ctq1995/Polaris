/**
 * simpleTodoService.ts 单元测试
 *
 * 测试简化待办服务的核心功能：
 * - 工作区管理
 * - CRUD 操作
 * - 查询功能
 * - 子任务管理
 * - 订阅机制
 * - 文件持久化
 *
 * 注意：所有 Tauri IPC 调用通过 vi.mocked(invoke) 进行 mock。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { TodoItem, TodoCreateParams } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// 导入被测模块（需要在 mock 之后）
import { SimpleTodoService, simpleTodoService } from './simpleTodoService';

// 获取 mock 函数
const mockInvoke = vi.mocked(invoke);

// ============================================================
// 辅助函数
// ============================================================

/**
 * 创建模拟的 TodoItem
 */
function createMockTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 'test-uuid-1',
    content: 'Test Todo',
    status: 'pending',
    priority: 'normal',
    createdAt: '2026-03-19T10:00:00.000Z',
    updatedAt: '2026-03-19T10:00:00.000Z',
    ...overrides,
  };
}

/**
 * 创建模拟的文件内容
 */
function createMockFileContent(todos: TodoItem[] = []): string {
  return JSON.stringify({
    version: '1.0.0',
    updatedAt: '2026-03-19T10:00:00.000Z',
    todos,
  });
}

// ============================================================
// 工作区管理测试
// ============================================================
describe('工作区管理', () => {
  let service: SimpleTodoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SimpleTodoService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getCurrentWorkspacePath', () => {
    it('初始状态应返回 null', () => {
      expect(service.getCurrentWorkspacePath()).toBeNull();
    });

    it('设置工作区后应返回路径', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent());

      await service.setWorkspace('/test/workspace');

      expect(service.getCurrentWorkspacePath()).toBe('/test/workspace');
    });
  });

  describe('setWorkspace', () => {
    it('应加载文件中的待办', async () => {
      const mockTodos = [createMockTodo({ id: 'todo-1', content: 'Task 1' })];
      mockInvoke.mockResolvedValueOnce(createMockFileContent(mockTodos));

      const count = await service.setWorkspace('/test/workspace');

      expect(mockInvoke).toHaveBeenCalledWith('read_file_absolute', {
        path: '/test/workspace/.polaris/todos.json',
      });
      expect(count).toBe(1);
      expect(service.getAllTodos()).toHaveLength(1);
    });

    it('文件不存在时应初始化为空并创建文件', async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error('File not found'))
        .mockResolvedValueOnce(undefined);

      const count = await service.setWorkspace('/test/workspace');

      expect(count).toBe(0);
      expect(service.getAllTodos()).toHaveLength(0);
      // 应调用 write_file_absolute 创建文件
      expect(mockInvoke).toHaveBeenCalledWith(
        'write_file_absolute',
        expect.objectContaining({
          path: '/test/workspace/.polaris/todos.json',
        })
      );
    });

    it('相同工作区不强制重载时应跳过', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([createMockTodo()]));

      await service.setWorkspace('/test/workspace');
      const invokeCountAfterFirst = mockInvoke.mock.calls.length;

      const count = await service.setWorkspace('/test/workspace');

      // 第二次调用不应增加 invoke 调用次数
      expect(mockInvoke.mock.calls.length).toBe(invokeCountAfterFirst);
      expect(count).toBe(1);
    });

    it('相同工作区强制重载时应重新加载', async () => {
      mockInvoke
        .mockResolvedValueOnce(createMockFileContent([createMockTodo()]))
        .mockResolvedValueOnce(createMockFileContent([createMockTodo(), createMockTodo({ id: 'todo-2' })]));

      await service.setWorkspace('/test/workspace');
      const invokeCountAfterFirst = mockInvoke.mock.calls.length;

      const count = await service.setWorkspace('/test/workspace', true);

      // 强制重载应增加一次 read 调用
      expect(mockInvoke.mock.calls.length).toBeGreaterThan(invokeCountAfterFirst);
      expect(count).toBe(2);
    });

    it('应返回待办数量', async () => {
      const mockTodos = [
        createMockTodo({ id: '1' }),
        createMockTodo({ id: '2' }),
        createMockTodo({ id: '3' }),
      ];
      mockInvoke.mockResolvedValueOnce(createMockFileContent(mockTodos));

      const count = await service.setWorkspace('/test/workspace');

      expect(count).toBe(3);
    });
  });
});

// ============================================================
// 查询功能测试
// ============================================================
describe('查询功能', () => {
  let service: SimpleTodoService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new SimpleTodoService();

    // 初始化工作区并加载测试数据
    const mockTodos = [
      createMockTodo({ id: '1', status: 'pending', priority: 'low' }),
      createMockTodo({ id: '2', status: 'in_progress', priority: 'normal' }),
      createMockTodo({ id: '3', status: 'completed', priority: 'high' }),
      createMockTodo({ id: '4', status: 'pending', priority: 'urgent' }),
    ];
    mockInvoke.mockResolvedValueOnce(createMockFileContent(mockTodos));
    await service.setWorkspace('/test/workspace');
  });

  describe('getAllTodos', () => {
    it('应返回所有待办的数组副本', () => {
      const todos = service.getAllTodos();

      expect(todos).toHaveLength(4);
      // 验证数组是副本（修改数组本身不影响原数组）
      const originalLength = service.getAllTodos().length;
      todos.push(createMockTodo({ id: 'new' }));
      expect(service.getAllTodos().length).toBe(originalLength);
    });

    it('未设置工作区时应返回空数组', () => {
      const newService = new SimpleTodoService();
      expect(newService.getAllTodos()).toEqual([]);
    });
  });

  describe('getTodosByStatus', () => {
    it('应筛选 pending 状态', () => {
      const todos = service.getTodosByStatus('pending');

      expect(todos).toHaveLength(2);
      expect(todos.every(t => t.status === 'pending')).toBe(true);
    });

    it('应筛选 in_progress 状态', () => {
      const todos = service.getTodosByStatus('in_progress');

      expect(todos).toHaveLength(1);
      expect(todos[0].status).toBe('in_progress');
    });

    it('应筛选 completed 状态', () => {
      const todos = service.getTodosByStatus('completed');

      expect(todos).toHaveLength(1);
      expect(todos[0].status).toBe('completed');
    });

    it('status=all 应返回所有待办', () => {
      const todos = service.getTodosByStatus('all');

      expect(todos).toHaveLength(4);
    });
  });

  describe('getStats', () => {
    it('应返回正确的统计信息', () => {
      const stats = service.getStats();

      expect(stats.total).toBe(4);
      expect(stats.pending).toBe(2);
      expect(stats.inProgress).toBe(1);
      expect(stats.completed).toBe(1);
    });

    it('空待办列表应返回零值统计', async () => {
      const emptyService = new SimpleTodoService();
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await emptyService.setWorkspace('/test/workspace');

      const stats = emptyService.getStats();

      expect(stats.total).toBe(0);
      expect(stats.pending).toBe(0);
      expect(stats.inProgress).toBe(0);
      expect(stats.completed).toBe(0);
    });
  });
});

// ============================================================
// CRUD 操作测试
// ============================================================
describe('CRUD 操作', () => {
  let service: SimpleTodoService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new SimpleTodoService();

    // 初始化工作区
    mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
    await service.setWorkspace('/test/workspace');
    vi.clearAllMocks(); // 清除初始化调用记录
  });

  describe('createTodo', () => {
    it('应创建基本待办', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const params: TodoCreateParams = {
        content: 'New Task',
      };
      const todo = await service.createTodo(params);

      expect(todo.content).toBe('New Task');
      expect(todo.status).toBe('pending');
      expect(todo.priority).toBe('normal');
      expect(todo.id).toBeDefined();
      expect(todo.createdAt).toBeDefined();
      expect(todo.updatedAt).toBeDefined();
      expect(mockInvoke).toHaveBeenCalledWith(
        'write_file_absolute',
        expect.objectContaining({
          path: '/test/workspace/.polaris/todos.json',
        })
      );
    });

    it('应正确设置可选字段', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const params: TodoCreateParams = {
        content: 'Task with options',
        description: 'Detailed description',
        priority: 'high',
        tags: ['important', 'work'],
        relatedFiles: ['/src/index.ts'],
        dueDate: '2026-04-01',
        estimatedHours: 4,
      };
      const todo = await service.createTodo(params);

      expect(todo.description).toBe('Detailed description');
      expect(todo.priority).toBe('high');
      expect(todo.tags).toEqual(['important', 'work']);
      expect(todo.relatedFiles).toEqual(['/src/index.ts']);
      expect(todo.dueDate).toBe('2026-04-01');
      expect(todo.estimatedHours).toBe(4);
    });

    it('应创建带子任务的待办', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const params: TodoCreateParams = {
        content: 'Task with subtasks',
        subtasks: [
          { title: 'Subtask 1' },
          { title: 'Subtask 2' },
        ],
      };
      const todo = await service.createTodo(params);

      expect(todo.subtasks).toHaveLength(2);
      expect(todo.subtasks![0].title).toBe('Subtask 1');
      expect(todo.subtasks![0].completed).toBe(false);
      expect(todo.subtasks![0].id).toBeDefined();
      expect(todo.subtasks![0].createdAt).toBeDefined();
    });

    it('创建后应能查询到', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.createTodo({ content: 'Task 1' });
      await service.createTodo({ content: 'Task 2' });

      expect(service.getAllTodos()).toHaveLength(2);
    });

    it('未设置工作区时创建应保存失败但不抛出错误', async () => {
      const noWorkspaceService = new SimpleTodoService();

      // 由于 log.warn 不会抛出错误，这里会正常执行
      // 但 invoke 不会被调用
      const todo = await noWorkspaceService.createTodo({ content: 'Test' });

      expect(mockInvoke).not.toHaveBeenCalled();
      // 待办仍然添加到内存
      expect(noWorkspaceService.getAllTodos()).toHaveLength(1);
    });
  });

  describe('updateTodo', () => {
    it('应更新待办内容', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      // 先创建一个待办
      const created = await service.createTodo({ content: 'Original' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { content: 'Updated' });

      const updated = service.getAllTodos()[0];
      expect(updated.content).toBe('Updated');
      expect(updated.updatedAt).toBeDefined();
    });

    it('应更新状态并记录完成时间', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const created = await service.createTodo({ content: 'Task' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { status: 'completed' });

      const updated = service.getAllTodos()[0];
      expect(updated.status).toBe('completed');
      expect(updated.completedAt).toBeDefined();
    });

    it('已完成任务再次更新状态不应覆盖完成时间', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const created = await service.createTodo({ content: 'Task' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { status: 'completed' });
      const firstCompletedAt = service.getAllTodos()[0].completedAt;

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { content: 'Updated content' });

      const updated = service.getAllTodos()[0];
      expect(updated.completedAt).toBe(firstCompletedAt);
    });

    it('更新不存在的待办应抛出错误', async () => {
      await expect(
        service.updateTodo('non-existent', { content: 'Updated' })
      ).rejects.toThrow('待办不存在: non-existent');
    });

    it('空内容不应覆盖原有内容', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const created = await service.createTodo({ content: 'Original Content' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { content: '' });

      const updated = service.getAllTodos()[0];
      expect(updated.content).toBe('Original Content');
    });

    it('空白字符串不应覆盖原有内容', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const created = await service.createTodo({ content: 'Original Content' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { content: '   ' });

      const updated = service.getAllTodos()[0];
      expect(updated.content).toBe('Original Content');
    });

    it('有效内容应正常更新', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const created = await service.createTodo({ content: 'Original Content' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { content: 'Valid Content' });

      const updated = service.getAllTodos()[0];
      expect(updated.content).toBe('Valid Content');
    });
  });

  describe('deleteTodo', () => {
    it('应删除指定待办', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const created = await service.createTodo({ content: 'To Delete' });
      expect(service.getAllTodos()).toHaveLength(1);
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.deleteTodo(created.id);

      expect(service.getAllTodos()).toHaveLength(0);
    });

    it('删除不存在的待办应抛出错误', async () => {
      await expect(
        service.deleteTodo('non-existent')
      ).rejects.toThrow('待办不存在: non-existent');
    });

    it('应删除正确的待办', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const todo1 = await service.createTodo({ content: 'Task 1' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      const todo2 = await service.createTodo({ content: 'Task 2' });
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.deleteTodo(todo1.id);

      const remaining = service.getAllTodos();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe(todo2.id);
    });
  });
});

// ============================================================
// 子任务管理测试
// ============================================================
describe('子任务管理', () => {
  let service: SimpleTodoService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new SimpleTodoService();

    mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
    await service.setWorkspace('/test/workspace');
    vi.clearAllMocks();
  });

  describe('toggleSubtask', () => {
    it('应切换子任务完成状态', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({
        content: 'Task with subtasks',
        subtasks: [{ title: 'Subtask 1' }],
      });
      const subtaskId = todo.subtasks![0].id;
      vi.clearAllMocks();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.toggleSubtask(todo.id, subtaskId);

      const updated = service.getAllTodos()[0];
      expect(updated.subtasks![0].completed).toBe(true);

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.toggleSubtask(todo.id, subtaskId);

      const toggled = service.getAllTodos()[0];
      expect(toggled.subtasks![0].completed).toBe(false);
    });

    it('待办不存在时应抛出错误', async () => {
      await expect(
        service.toggleSubtask('non-existent', 'subtask-id')
      ).rejects.toThrow('待办不存在: non-existent');
    });

    it('子任务不存在时应抛出错误', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({
        content: 'Task with subtasks',
        subtasks: [{ title: 'Subtask 1' }],
      });

      await expect(
        service.toggleSubtask(todo.id, 'non-existent-subtask')
      ).rejects.toThrow('子任务不存在: non-existent-subtask');
    });

    it('没有子任务的待办应抛出错误', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({ content: 'Task without subtasks' });

      await expect(
        service.toggleSubtask(todo.id, 'any-subtask')
      ).rejects.toThrow('子任务不存在: any-subtask');
    });
  });
});

// ============================================================
// 订阅机制测试
// ============================================================
describe('订阅机制', () => {
  let service: SimpleTodoService;

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new SimpleTodoService();

    mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
    await service.setWorkspace('/test/workspace');
    vi.clearAllMocks();
  });

  describe('subscribe', () => {
    it('应在创建待办时通知监听器', async () => {
      const listener = vi.fn();
      service.subscribe(listener);

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.createTodo({ content: 'New Task' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应在更新待办时通知监听器', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const todo = await service.createTodo({ content: 'Task' });

      const listener = vi.fn();
      service.subscribe(listener);

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(todo.id, { content: 'Updated' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应在删除待办时通知监听器', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const todo = await service.createTodo({ content: 'Task' });

      const listener = vi.fn();
      service.subscribe(listener);

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.deleteTodo(todo.id);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('应在切换子任务时通知监听器', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const todo = await service.createTodo({
        content: 'Task',
        subtasks: [{ title: 'Subtask' }],
      });

      const listener = vi.fn();
      service.subscribe(listener);

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.toggleSubtask(todo.id, todo.subtasks![0].id);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('取消订阅后不应收到通知', async () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);
      unsubscribe();

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.createTodo({ content: 'New Task' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('多个监听器应都被通知', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      service.subscribe(listener1);
      service.subscribe(listener2);
      service.subscribe(listener3);

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.createTodo({ content: 'New Task' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });

    it('部分监听器取消订阅后其他应继续收到通知', async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      service.subscribe(listener1);
      const unsub2 = service.subscribe(listener2);
      service.subscribe(listener3);

      unsub2(); // 取消 listener2

      mockInvoke.mockResolvedValueOnce(undefined);
      await service.createTodo({ content: 'New Task' });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).not.toHaveBeenCalled();
      expect(listener3).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================
// 文件持久化测试
// ============================================================
describe('文件持久化', () => {
  let service: SimpleTodoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SimpleTodoService();
  });

  describe('文件格式', () => {
    it('保存时应写入正确格式', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.createTodo({ content: 'New Task' });

      expect(mockInvoke).toHaveBeenCalledWith(
        'write_file_absolute',
        expect.objectContaining({
          path: '/test/workspace/.polaris/todos.json',
          content: expect.stringContaining('"version": "1.0.0"'),
        })
      );
    });

    it('保存应包含 updatedAt 时间戳', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      await service.createTodo({ content: 'New Task' });

      const call = mockInvoke.mock.calls[0];
      const content = JSON.parse(call[1].content);

      expect(content.updatedAt).toBeDefined();
      expect(content.todos).toHaveLength(1);
    });

    it('加载时应解析正确的数据', async () => {
      const mockTodos = [
        createMockTodo({ id: '1', content: 'Task 1', status: 'pending' }),
        createMockTodo({ id: '2', content: 'Task 2', status: 'completed' }),
      ];
      mockInvoke.mockResolvedValueOnce(createMockFileContent(mockTodos));

      await service.setWorkspace('/test/workspace');

      const todos = service.getAllTodos();
      expect(todos).toHaveLength(2);
      expect(todos[0].content).toBe('Task 1');
      expect(todos[1].status).toBe('completed');
    });

    it('加载缺少 todos 字段的文件时应初始化为空', async () => {
      mockInvoke.mockResolvedValueOnce(JSON.stringify({ version: '1.0.0' }));

      await service.setWorkspace('/test/workspace');

      expect(service.getAllTodos()).toEqual([]);
    });

    it('加载无效 JSON 时应初始化为空', async () => {
      mockInvoke.mockRejectedValueOnce(new Error('Invalid JSON'));

      await service.setWorkspace('/test/workspace');

      expect(service.getAllTodos()).toEqual([]);
    });
  });

  describe('路径处理', () => {
    it('应使用正确的工作区路径', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));

      await service.setWorkspace('/custom/path/to/workspace');

      expect(mockInvoke).toHaveBeenCalledWith('read_file_absolute', {
        path: '/custom/path/to/workspace/.polaris/todos.json',
      });
    });

    it('Windows 路径应正确处理', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));

      await service.setWorkspace('D:\\projects\\my-project');

      expect(mockInvoke).toHaveBeenCalledWith('read_file_absolute', {
        path: 'D:\\projects\\my-project/.polaris/todos.json',
      });
    });
  });
});

// ============================================================
// 边界情况和错误处理测试
// ============================================================
describe('边界情况和错误处理', () => {
  let service: SimpleTodoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SimpleTodoService();
  });

  describe('空值处理', () => {
    it('创建待办时空子任务数组应正常处理', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({
        content: 'Task',
        subtasks: [],
      });

      expect(todo.subtasks).toEqual([]);
    });

    it('创建待办时空标签数组应正常处理', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({
        content: 'Task',
        tags: [],
      });

      expect(todo.tags).toEqual([]);
    });
  });

  describe('并发操作', () => {
    it('连续创建多个待办应全部保存', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValue(undefined);

      await Promise.all([
        service.createTodo({ content: 'Task 1' }),
        service.createTodo({ content: 'Task 2' }),
        service.createTodo({ content: 'Task 3' }),
      ]);

      // 由于并发操作，最终应该有 3 个待办
      expect(service.getAllTodos().length).toBe(3);
    });

    it('并发更新不同待办应正常工作', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      mockInvoke.mockResolvedValueOnce(undefined);
      const todo1 = await service.createTodo({ content: 'Task 1' });
      const todo2 = await service.createTodo({ content: 'Task 2' });

      vi.clearAllMocks();
      mockInvoke.mockResolvedValue(undefined);

      await Promise.all([
        service.updateTodo(todo1.id, { status: 'completed' }),
        service.updateTodo(todo2.id, { status: 'in_progress' }),
      ]);

      const todos = service.getAllTodos();
      const t1 = todos.find(t => t.id === todo1.id);
      const t2 = todos.find(t => t.id === todo2.id);
      expect(t1?.status).toBe('completed');
      expect(t2?.status).toBe('in_progress');
    });
  });

  describe('特殊字符处理', () => {
    it('待办内容应正确处理 Unicode 字符', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({
        content: '任务：完成开发 🔥',
        description: '详细说明：这是一段中文描述 📝',
        tags: ['重要', '紧急'],
      });

      expect(todo.content).toBe('任务：完成开发 🔥');
      expect(todo.description).toBe('详细说明：这是一段中文描述 📝');
      expect(todo.tags).toEqual(['重要', '紧急']);
    });

    it('待办内容应正确处理特殊 JSON 字符', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const specialContent = 'Task with "quotes" and \\backslash\\ and\nnewline';
      const todo = await service.createTodo({
        content: specialContent,
      });

      expect(todo.content).toBe(specialContent);
    });

    it('待办内容应正确处理 HTML 标签', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const htmlContent = '<div>HTML content</div><script>alert("xss")</script>';
      const todo = await service.createTodo({
        content: htmlContent,
      });

      expect(todo.content).toBe(htmlContent);
    });
  });

  describe('极端数据', () => {
    it('超长内容应正常处理', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const longContent = 'A'.repeat(10000);
      const todo = await service.createTodo({
        content: longContent,
      });

      expect(todo.content).toBe(longContent);
    });

    it('大量待办应正常处理', async () => {
      const manyTodos = Array.from({ length: 100 }, (_, i) =>
        createMockTodo({ id: `todo-${i}`, content: `Task ${i}` })
      );
      mockInvoke.mockResolvedValueOnce(createMockFileContent(manyTodos));

      await service.setWorkspace('/test/workspace');

      expect(service.getAllTodos()).toHaveLength(100);
    });

    it('大量子任务应正常处理', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const manySubtasks = Array.from({ length: 50 }, (_, i) => ({
        title: `Subtask ${i}`,
      }));
      const todo = await service.createTodo({
        content: 'Task with many subtasks',
        subtasks: manySubtasks,
      });

      expect(todo.subtasks).toHaveLength(50);
    });
  });

  describe('日期处理', () => {
    it('创建时间应使用 ISO 格式', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);

      const todo = await service.createTodo({ content: 'Task' });

      // ISO 8601 格式验证
      expect(new Date(todo.createdAt).toISOString()).toBe(todo.createdAt);
    });

    it('更新时间应使用 ISO 格式', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      const created = await service.createTodo({ content: 'Task' });

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { content: 'Updated' });

      const updated = service.getAllTodos()[0];
      expect(new Date(updated.updatedAt).toISOString()).toBe(updated.updatedAt);
    });

    it('完成时间应使用 ISO 格式', async () => {
      mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
      await service.setWorkspace('/test/workspace');

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      const created = await service.createTodo({ content: 'Task' });

      vi.clearAllMocks();
      mockInvoke.mockResolvedValueOnce(undefined);
      await service.updateTodo(created.id, { status: 'completed' });

      const updated = service.getAllTodos()[0];
      expect(updated.completedAt).toBeDefined();
      expect(new Date(updated.completedAt!).toISOString()).toBe(updated.completedAt);
    });
  });
});

// ============================================================
// 单例实例测试
// ============================================================
describe('单例实例', () => {
  it('simpleTodoService 应是 SimpleTodoService 的实例', () => {
    expect(simpleTodoService).toBeInstanceOf(SimpleTodoService);
  });
});

// ============================================================
// 数据一致性测试
// ============================================================
describe('数据一致性', () => {
  let service: SimpleTodoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SimpleTodoService();
  });

  it('多次获取待办应返回相同数据', async () => {
    const mockTodos = [createMockTodo({ id: '1', content: 'Task 1' })];
    mockInvoke.mockResolvedValueOnce(createMockFileContent(mockTodos));

    await service.setWorkspace('/test/workspace');

    const first = service.getAllTodos();
    const second = service.getAllTodos();
    const third = service.getTodosByStatus('all');

    expect(first).toEqual(second);
    expect(first).toEqual(third);
  });

  it('统计信息应与实际数据一致', async () => {
    const mockTodos = [
      createMockTodo({ id: '1', status: 'pending' }),
      createMockTodo({ id: '2', status: 'pending' }),
      createMockTodo({ id: '3', status: 'in_progress' }),
      createMockTodo({ id: '4', status: 'completed' }),
    ];
    mockInvoke.mockResolvedValueOnce(createMockFileContent(mockTodos));

    await service.setWorkspace('/test/workspace');

    const stats = service.getStats();
    const all = service.getAllTodos();
    const pending = service.getTodosByStatus('pending');
    const inProgress = service.getTodosByStatus('in_progress');
    const completed = service.getTodosByStatus('completed');

    expect(stats.total).toBe(all.length);
    expect(stats.pending).toBe(pending.length);
    expect(stats.inProgress).toBe(inProgress.length);
    expect(stats.completed).toBe(completed.length);
  });
});

// ============================================================
// 错误恢复测试
// ============================================================
describe('错误恢复', () => {
  let service: SimpleTodoService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SimpleTodoService();
  });

  it('读取失败后应能继续操作', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Read failed'));

    await service.setWorkspace('/test/workspace');

    expect(service.getAllTodos()).toEqual([]);

    // 应该能继续创建
    vi.clearAllMocks();
    mockInvoke.mockResolvedValueOnce(undefined);
    const todo = await service.createTodo({ content: 'New Task' });

    expect(todo.content).toBe('New Task');
  });

  it('写入失败后应抛出错误', async () => {
    mockInvoke.mockResolvedValueOnce(createMockFileContent([]));
    await service.setWorkspace('/test/workspace');

    vi.clearAllMocks();
    mockInvoke.mockRejectedValueOnce(new Error('Write failed'));

    await expect(service.createTodo({ content: 'Task' })).rejects.toThrow('Write failed');
  });

  it('工作区未设置时保存应不调用 invoke', async () => {
    const noWorkspaceService = new SimpleTodoService();

    // 创建待办（不会保存到文件）
    await noWorkspaceService.createTodo({ content: 'Task' });

    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
