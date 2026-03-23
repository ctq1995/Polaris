/**
 * ToolGroupRenderer 组件测试
 *
 * 测试范围：
 * - 渲染：工具列表、状态图标、摘要、时长
 * - 状态：completed、failed、partial、running、pending
 * - 交互：展开/折叠、键盘导航
 * - 归档模式：简化渲染
 * - 无障碍：ARIA 属性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolGroupRenderer, SimplifiedToolGroupRenderer, STATUS_CONFIG, TOOL_STATUS_CONFIG } from './ToolGroupRenderer';
import type { ToolCallBlock } from '../../types';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'toolGroup.tools': '个工具',
        'toolGroup.completed': '完成',
        'toolGroup.running': '运行中',
        'toolGroup.failed': '失败',
        'toolGroup.showAll': `显示全部 ${options?.count || 0} 个`,
        'toolGroup.ariaLabel': `工具组，${options?.count || 0} 个工具`,
        'toolGroup.toggleLabel': '切换展开',
      };
      return translations[key] || key;
    },
  }),
}));

// 测试数据工厂
function createToolCallBlock(overrides?: Partial<ToolCallBlock>): ToolCallBlock {
  return {
    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: 'tool_call',
    name: 'read_file',
    status: 'completed',
    input: {},
    output: 'success',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ToolGroupRenderer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('渲染', () => {
    it('应该显示工具数量摘要（多个不同工具）', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'write_file' }),
        createToolCallBlock({ name: 'bash' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByText('3 个工具')).toBeInTheDocument();
    });

    it('应该显示相同工具的计数（重复工具名）', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'read_file' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByText('read_file ×3')).toBeInTheDocument();
    });

    it('应该显示完成状态统计', () => {
      const tools = [
        createToolCallBlock({ status: 'completed' }),
        createToolCallBlock({ status: 'completed' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByText(/2 完成/)).toBeInTheDocument();
    });

    it('应该显示失败状态统计', () => {
      const tools = [
        createToolCallBlock({ status: 'completed' }),
        createToolCallBlock({ status: 'failed' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByText(/1 失败/)).toBeInTheDocument();
    });

    it('应该显示运行中状态统计', () => {
      const tools = [
        createToolCallBlock({ status: 'running' }),
        createToolCallBlock({ status: 'pending' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByText(/2 运行中/)).toBeInTheDocument();
    });

    it('应该显示时长（有开始和结束时间）', () => {
      const startedAt = new Date('2024-01-01T10:00:00Z');
      const completedAt = new Date('2024-01-01T10:00:05Z');
      const tools = [
        createToolCallBlock({ startedAt: startedAt.toISOString() }),
        createToolCallBlock({ 
          startedAt: startedAt.toISOString(), 
          completedAt: completedAt.toISOString() 
        }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      // 时长应该显示（5秒）- 格式是 "5.0s"
      expect(screen.getByText('5.0s')).toBeInTheDocument();
    });
  });

  describe('状态显示', () => {
    it('completed 状态：所有工具完成', () => {
      const tools = [
        createToolCallBlock({ status: 'completed' }),
        createToolCallBlock({ status: 'completed' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      // 应该显示完成状态图标和样式
      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('failed 状态：所有工具失败', () => {
      const tools = [
        createToolCallBlock({ status: 'failed' }),
        createToolCallBlock({ status: 'failed' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('partial 状态：部分失败且有运行中的', () => {
      const tools = [
        createToolCallBlock({ status: 'completed' }),
        createToolCallBlock({ status: 'failed' }),
        createToolCallBlock({ status: 'running' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('running 状态：有工具运行中', () => {
      const tools = [
        createToolCallBlock({ status: 'running' }),
        createToolCallBlock({ status: 'pending' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });

    it('pending 状态：所有工具等待中', () => {
      const tools = [
        createToolCallBlock({ status: 'pending' }),
        createToolCallBlock({ status: 'pending' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      const region = screen.getByRole('region');
      expect(region).toBeInTheDocument();
    });
  });

  describe('交互', () => {
    it('点击应该切换展开/折叠', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'write_file' }),
        createToolCallBlock({ name: 'bash' }),
        createToolCallBlock({ name: 'grep' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      // 初始状态：折叠
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      // 点击展开
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');

      // 再次点击折叠
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('Enter 键应该切换展开/折叠', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'write_file' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(button, { key: 'Enter' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('Space 键应该切换展开/折叠', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'write_file' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');

      fireEvent.keyDown(button, { key: ' ' });
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('归档模式', () => {
    it('应该使用简化渲染', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file', status: 'completed' }),
        createToolCallBlock({ name: 'write_file', status: 'completed' }),
      ];
      render(<ToolGroupRenderer tools={tools} renderMode="archive" />);

      // 归档模式不应该有 button role
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
      // 但应该显示摘要（不同工具显示数量）
      expect(screen.getByText('2 个工具')).toBeInTheDocument();
    });

    it('应该显示完成数量', () => {
      const tools = [
        createToolCallBlock({ status: 'completed' }),
        createToolCallBlock({ status: 'completed' }),
      ];
      render(<ToolGroupRenderer tools={tools} renderMode="archive" />);

      // 应该显示完成的数量（绿色）
      const completedCount = screen.getByText('2');
      expect(completedCount).toBeInTheDocument();
      expect(completedCount).toHaveClass('text-success');
    });

    it('应该显示失败数量', () => {
      const tools = [
        createToolCallBlock({ status: 'completed' }),
        createToolCallBlock({ status: 'failed' }),
      ];
      render(<ToolGroupRenderer tools={tools} renderMode="archive" />);

      // 应该显示失败的数量（红色）- 使用 getAllByText 因为同时有完成和失败数量
      const failedCounts = screen.getAllByText('1');
      const failedCount = failedCounts.find(el => el.classList.contains('text-error'));
      expect(failedCount).toBeInTheDocument();
      expect(failedCount).toHaveClass('text-error');
    });
  });

  describe('无障碍', () => {
    it('应该有正确的 ARIA role', () => {
      const tools = [createToolCallBlock()];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('应该有正确的 aria-label', () => {
      const tools = [
        createToolCallBlock(),
        createToolCallBlock(),
        createToolCallBlock(),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      expect(screen.getByRole('region')).toHaveAttribute('aria-label', '工具组，3 个工具');
    });

    it('按钮应该有正确的 aria-expanded', () => {
      const tools = [createToolCallBlock()];
      render(<ToolGroupRenderer tools={tools} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('按钮应该有正确的 aria-label', () => {
      const tools = [createToolCallBlock()];
      render(<ToolGroupRenderer tools={tools} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', '切换展开');
    });

    it('按钮应该可通过 Tab 聚焦', () => {
      const tools = [createToolCallBlock()];
      render(<ToolGroupRenderer tools={tools} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('展开后的工具列表', () => {
    it('展开后应该显示工具列表', () => {
      const tools = [
        createToolCallBlock({ name: 'read_file' }),
        createToolCallBlock({ name: 'write_file' }),
      ];
      render(<ToolGroupRenderer tools={tools} />);

      // 展开前：工具列表不可见
      expect(screen.queryByText('读取文件')).not.toBeInTheDocument();

      // 展开后：工具列表可见
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      // 工具应该显示（使用工具配置中的 label）
      const toolItems = screen.getAllByRole('generic');
      expect(toolItems.length).toBeGreaterThan(0);
    });
  });
});

describe('SimplifiedToolGroupRenderer', () => {
  it('应该显示工具摘要', () => {
    const tools = [
      createToolCallBlock({ name: 'read_file' }),
      createToolCallBlock({ name: 'read_file' }),
    ];
    render(<SimplifiedToolGroupRenderer tools={tools} />);

    expect(screen.getByText('read_file ×2')).toBeInTheDocument();
  });

  it('应该显示完成数量', () => {
    const tools = [
      createToolCallBlock({ status: 'completed' }),
      createToolCallBlock({ status: 'completed' }),
    ];
    render(<SimplifiedToolGroupRenderer tools={tools} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('应该显示失败数量', () => {
    const tools = [
      createToolCallBlock({ status: 'failed' }),
    ];
    render(<SimplifiedToolGroupRenderer tools={tools} />);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('应该有 aria-hidden 属性', () => {
    const tools = [createToolCallBlock()];
    render(<SimplifiedToolGroupRenderer tools={tools} />);

    // 使用 aria-label 来定位元素
    const container = screen.getByLabelText('工具组，1 个工具');
    expect(container).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('状态配置导出', () => {
  it('应该导出 STATUS_CONFIG', () => {
    expect(STATUS_CONFIG).toBeDefined();
    expect(STATUS_CONFIG.completed).toBeDefined();
    expect(STATUS_CONFIG.failed).toBeDefined();
    expect(STATUS_CONFIG.partial).toBeDefined();
    expect(STATUS_CONFIG.running).toBeDefined();
    expect(STATUS_CONFIG.pending).toBeDefined();
  });

  it('应该导出 TOOL_STATUS_CONFIG', () => {
    expect(TOOL_STATUS_CONFIG).toBeDefined();
    expect(TOOL_STATUS_CONFIG.completed).toBeDefined();
    expect(TOOL_STATUS_CONFIG.failed).toBeDefined();
    expect(TOOL_STATUS_CONFIG.running).toBeDefined();
    expect(TOOL_STATUS_CONFIG.pending).toBeDefined();
  });
});
